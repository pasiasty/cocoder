FROM python

RUN apt update
RUN apt upgrade -y
RUN apt install golang -y
RUN apt install clangd -y
RUN apt install clang -y
RUN apt install python3 python3-pip -y
RUN apt install openjdk-17-jdk -y
RUN apt install maven -y

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64/

# should add to /etc/profile
# export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64/
# export PATH=$JAVA_HOME/bin:$PATH

RUN apt clean

RUN GO111MODULE=on go get golang.org/x/tools/gopls@latest

COPY requirements.txt /tmp/requirements.txt

RUN pip3 install -r /tmp/requirements.txt

# triggers node install
RUN /usr/local/bin/pyright-python --help

CMD /bin/bash