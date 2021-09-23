FROM node:16

WORKDIR /build
RUN npm i -g serve

ADD build /build

ENTRYPOINT ["/usr/local/bin/serve", "-s", "-l", "8080", "/build"]
