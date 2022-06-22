# coCoder

Welcome to coCoder! This is a tool that you might use for collaborative coding, rapid prototyping or whatever other use case that require you to use a shared, easy to access text editor. This project is currently hosted at https://cocoder.org.

## How do I use it?

It's very simple! All you need to do is click a big `Start new session` button on the welcome screen and share the obtained link with your friend. The editor supports all modern browsers, so you won't have to install anything to make it work. Every session is being stored for the full week from last activity on it, so please, don't use this project as a long term storage of your work.

## Local development

### Running local instance

You'll need `npm`, `golang` and `docker` installed on your machine. You should run:

```
cd server && go run application.go
```

in order to spin up the backend of the service. Executing:

```
cd ui && npm i && ng serve
```

will spin up the frontend. After running these commands coCoder will be available under http://localhost:4200.

### Execution environment

The execution environment for user provided code is ran in a docker container. The image of this container can be found in the [Dockerfile](Dockerfile) in this project. The updates of this file **are not** performed automatically. In order to propagate such changes you should do the following things:

1. Build new image locally: `docker build . -t mpasek/cocoder-executor:latest`
1. Push it to dockerhub: `docker image push mpasek/cocoder-executor:latest`

### Running tests

#### Running tests of the backend

`cd server && go test ./...`

#### Running tests of the frontend

`cd ui && npm i && ng test`

## How do I contribute?

Simple send a PR to us!

## How does coCoder look like?

### Light theme

![Light theme](/ui/visualizations/colors-light.png)

### Dark theme

![Dark theme](/ui/visualizations/colors-dark.png)
