import { CustomTransportStrategy, Server } from '@nestjs/microservices';
import * as dgram from 'dgram';

export class UdpServer extends Server implements CustomTransportStrategy {
  private server: dgram.Socket;

  constructor(private readonly options: { host: string; port: number }) {
    super();
  }

  listen(callback: () => void) {
    this.server = dgram.createSocket('udp4'); // You can use 'udp6' for IPv6

    this.server.on('message', (message: Buffer, remote: dgram.RemoteInfo) => {
      const handler = this.getHandlers().get('message');
      if (handler) {
        const data = message.toString();
        handler(data, remote);
      }
    });

    this.server.bind(this.options.port, this.options.host, () => {
      console.log(
        `UDP server is listening on ${this.options.host}:${this.options.port}`,
      );
      callback();
    });
  }

  close() {
    this.server.close(() => {
      console.log('UDP server closed');
    });
  }
}
