FROM python

RUN apt update
RUN apt upgrade -y
RUN apt install golang -y
RUN apt install clangd -y
RUN apt install clang -y
RUN apt install python3 python3-pip -y
RUN apt install openjdk-17-jdk -y
RUN apt install maven -y

RUN apt clean

# Installing JDTLS - https://github.com/eclipse/eclipse.jdt.ls
RUN mkdir /opt/jdtls
RUN wget https://download.eclipse.org/jdtls/milestones/1.9.0/jdt-language-server-1.9.0-202203031534.tar.gz
RUN tar -xf jdt-language-server-1.9.0-202203031534.tar.gz -C /opt/jdtls/
RUN rm jdt-language-server-1.9.0-202203031534.tar.gz

# setting up Java env variables
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

# installing gopls
RUN GO111MODULE=on go get golang.org/x/tools/gopls@latest

# installing Python dependencies
COPY requirements.txt /tmp/requirements.txt

RUN pip3 install --upgrade pip setuptools
RUN pip3 install -r /tmp/requirements.txt

# triggers node install
RUN /usr/local/bin/pyright-python --help

COPY scripts/run_jdtls.sh /usr/local/bin/run_jdtls
COPY scripts/run_gopls.sh /usr/local/bin/run_gopls

CMD /bin/bash