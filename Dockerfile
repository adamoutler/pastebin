FROM alpine
RUN apk add git npm
COPY ./ /opt/pastebin/
EXPOSE 7777
WORKDIR /opt/pastebin
CMD ["npm", "start"]
