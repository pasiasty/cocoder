#!/usr/bin/env bash

USER_ID=$1;

mkdir -p /tmp/java/${USER_ID}
touch /tmp/java/${USER_ID}/0_code.java

python /opt/jdtls/bin/jdtls -data /tmp/java/${USER_ID} -configuration /opt/jdtls/config_linux
