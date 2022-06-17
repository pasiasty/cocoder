FROM python

RUN apt update
RUN apt upgrade -y
RUN apt install golang -y
RUN apt install clangd -y
RUN apt install clang -y

RUN apt clean

CMD /bin/bash