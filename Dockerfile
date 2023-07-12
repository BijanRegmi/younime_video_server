FROM node:19

WORKDIR /younime-video-server

COPY . .

RUN npm install

RUN npm run build

CMD npm run start
