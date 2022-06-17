package executor

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/pasiasty/cocoder/server/common"
	"github.com/pasiasty/cocoder/server/users_manager"
)

type Executor struct {
}

func New() *Executor {
	return &Executor{}
}

func runFileContent(language string) (string, error) {
	switch language {
	case "python":
		return "#!/bin/bash\n\npython3 /mnt/code.txt", nil
	}

	return "", fmt.Errorf("language: %s is not supported", language)
}

func postprocessStdout(s string) string {
	return strings.TrimSpace(s)
}

func postprocessStderr(s string) string {
	s = strings.Replace(s, "WARNING: Your kernel does not support swap limit capabilities or the cgroup is not mounted. Memory limited without swap.", "", 1)
	return postprocessStdout(s)
}

func (e *Executor) Execute(ctx context.Context, userID users_manager.UserID, language, code, stdin string) (*common.ExecutionResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	d, err := ioutil.TempDir("", "")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(d)

	rfc, err := runFileContent(language)
	if err != nil {
		return nil, err
	}

	runFile, err := os.Create(fmt.Sprintf("%s/run.sh", d))
	if err != nil {
		return nil, err
	}
	if _, err := runFile.WriteString(rfc); err != nil {
		return nil, err
	}
	os.Chmod(runFile.Name(), 0111)

	if err := runFile.Close(); err != nil {
		return nil, err
	}

	codeFile, err := os.Create(fmt.Sprintf("%s/code.txt", d))
	if err != nil {
		return nil, err
	}
	if _, err := codeFile.WriteString(code); err != nil {
		return nil, err
	}
	if err := codeFile.Close(); err != nil {
		return nil, err
	}

	// cmd := exec.CommandContext(ctx, "docker", "run", "-v", fmt.Sprintf("%v:/mnt", d), "--rm", "-i", "--memory", "128MB", "--memory-swap", "0", "--cpus", "0.5", "--read-only", "--network", "none", "python", `/mnt/run.sh`)

	cmd := exec.CommandContext(ctx, "python3", codeFile.Name())
	cmd.Stdin = strings.NewReader(stdin)
	stdoutBuf := &bytes.Buffer{}
	stderrBuf := &bytes.Buffer{}

	cmd.Stdout = stdoutBuf
	cmd.Stderr = stderrBuf

	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return &common.ExecutionResponse{
				ErrorMessage: "Execution timed out",
			}, nil
		}
		return &common.ExecutionResponse{
			ErrorMessage: fmt.Sprintf("failed (%v)", err),
			Stdout:       postprocessStdout(stdoutBuf.String()),
			Stderr:       postprocessStderr(stderrBuf.String()),
		}, nil
	}

	return &common.ExecutionResponse{
		Stdout: postprocessStdout(stdoutBuf.String()),
		Stderr: postprocessStderr(stderrBuf.String()),
	}, nil
}
