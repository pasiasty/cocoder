FROM python

RUN apt update
RUN apt upgrade -y
RUN apt install golang -y
RUN apt install clangd -y
RUN apt install clang -y

RUN apt clean

RUN GO111MODULE=on go get golang.org/x/tools/gopls@latest

CMD /bin/bash