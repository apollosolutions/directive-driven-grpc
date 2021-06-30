FROM node:14-alpine
WORKDIR /web

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY bin bin/
COPY src src/
EXPOSE 4000

USER node
CMD src/docker_entrypoint.sh
