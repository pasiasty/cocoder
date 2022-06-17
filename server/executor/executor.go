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

type languageDefinition struct {
	extension string
	commands  []commandDefinition
	timeout   time.Duration
}

type commandDefinition struct {
	name      string
	cmd       string
	readonly  bool
	usesSTDIN bool
}

var languageDefinitions = map[string]languageDefinition{
	"python": {
		timeout:   10 * time.Second,
		extension: "py",
		commands: []commandDefinition{
			{
				name:      "run",
				cmd:       "python3 /mnt/code.py",
				readonly:  true,
				usesSTDIN: true,
			},
		},
	},
	"cpp": {
		timeout:   15 * time.Second,
		extension: "cpp",
		commands: []commandDefinition{
			{
				name: "compile",
				cmd:  "clang++ /mnt/code.cpp -o /mnt/code",
			},
			{
				name:      "run",
				cmd:       "/mnt/code",
				readonly:  true,
				usesSTDIN: true,
			},
		},
	},
	"go": {
		timeout:   15 * time.Second,
		extension: "go",
		commands: []commandDefinition{
			{
				name: "compile",
				cmd:  "cd /mnt && go build code.go",
			},
			{
				name:      "run",
				cmd:       "/mnt/code",
				readonly:  true,
				usesSTDIN: true,
			},
		},
	},
}

func runCommand(ctx context.Context, cd commandDefinition, d string, stdin string) (*common.ExecutionResponse, error) {
	rfc := fmt.Sprintf("#!/bin/bash\n\n%s", cd.cmd)

	runFilename := fmt.Sprintf("run_%s.sh", cd.name)

	runFile, err := os.Create(fmt.Sprintf("%s/%s", d, runFilename))
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

	args := []string{
		"run",
		"-v",
		fmt.Sprintf("%v:/mnt", d),
		"--rm",
		"-i",
		"--memory",
		"128MB",
		"--memory-swap",
		"0",
		"--cpus",
		"0.5",
	}

	if cd.readonly {
		args = append(args, "--read-only")
	}

	args = append(args, "--network", "none", "mpasek/cocoder-executor", fmt.Sprintf("/mnt/%s", runFilename))
	cmd := exec.CommandContext(ctx, "docker", args...)

	if cd.usesSTDIN {
		cmd.Stdin = strings.NewReader(stdin)
	}

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
			ErrorMessage: fmt.Sprintf("%s has failed (%v)", cd.name, err),
			Stdout:       postprocessStdout(stdoutBuf.String()),
			Stderr:       postprocessStderr(stderrBuf.String()),
		}, nil
	}

	return &common.ExecutionResponse{
		Stdout: postprocessStdout(stdoutBuf.String()),
		Stderr: postprocessStderr(stderrBuf.String()),
	}, nil
}

type Executor struct {
}

func New() *Executor {
	return &Executor{}
}

func postprocessStdout(s string) string {
	return strings.TrimSpace(s)
}

func postprocessStderr(s string) string {
	s = strings.Replace(s, "WARNING: Your kernel does not support swap limit capabilities or the cgroup is not mounted. Memory limited without swap.", "", 1)
	return postprocessStdout(s)
}

func (e *Executor) Execute(ctx context.Context, userID users_manager.UserID, language, code, stdin string) (*common.ExecutionResponse, error) {
	ld, ok := languageDefinitions[language]
	if !ok {
		return nil, fmt.Errorf("language: %s is not supported", language)
	}

	ctx, cancel := context.WithTimeout(ctx, ld.timeout)
	defer cancel()

	d, err := ioutil.TempDir("", "")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(d)

	codeFile, err := os.Create(fmt.Sprintf("%s/code.%s", d, ld.extension))
	if err != nil {
		return nil, err
	}
	if _, err := codeFile.WriteString(code); err != nil {
		return nil, err
	}
	if err := codeFile.Close(); err != nil {
		return nil, err
	}

	var lastRes *common.ExecutionResponse = nil

	for _, cd := range ld.commands {
		resp, err := runCommand(ctx, cd, d, stdin)
		if err != nil {
			return nil, err
		}
		if resp.ErrorMessage != "" {
			return resp, err
		}
		lastRes = resp
	}

	return lastRes, nil
}
