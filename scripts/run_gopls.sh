#!/usr/bin/env bash

USER_ID=$1;

mkdir -p /tmp/go/${USER_ID}
touch /tmp/java/${USER_ID}/0_code.go

/root/go/bin/gopls
