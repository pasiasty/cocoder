FROM python

RUN apt update
RUN apt upgrade -y
RUN apt install golang -y
RUN apt install clangd -y
RUN apt install clang -y
RUN apt install python3 python3-pip -y

RUN apt clean

RUN GO111MODULE=on go get golang.org/x/tools/gopls@latest

COPY requirements.txt /tmp/requirements.txt

RUN pip3 install -r /tmp/requirements.txt

CMD /bin/bash