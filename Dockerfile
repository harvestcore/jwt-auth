FROM node:14.16-alpine

WORKDIR /app

COPY . .
COPY ./.env.docker ./.env
RUN npm install

EXPOSE 8080

CMD ["npm", "start"]
