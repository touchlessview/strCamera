import { Constraints, defaultVideoConfig, Config } from './config';
import { StreamModule } from '../streamModule';

export class VideoStreem extends StreamModule {

  videoElement: HTMLVideoElement;
  config: Config;
  
  constructor(config?: Config) {
    super()
    this.config = {...defaultVideoConfig, ...config};
  }

  public setConfig(config?: Config): void {
    this.config = {...this.config, ...config};
  }

  public async create() {
    this._willMount();
    this.videoElement = document.createElement('video');
    this.videoElement.width = this.config.width;
    this.videoElement.height = this.config.height;
    this.videoElement.autoplay = this.config.autoplay;
    if (this.config.containerId) {
      const container = document.getElementById(this.config.containerId)
      if (container) container.appendChild(this.videoElement);
    }
    await this.play();
    this._didMount();
    console.log('Video created')
  }

  public async play() {
    if (this.config.source) {
      this.videoElement.src = this.config.source;
    } else {
      const constraints: Constraints = {
        audio: false,
        video: {
          width: this.config.width,
          height: this.config.height,
          frameRate: {...this.config.frameRate}
        }
      };
      if (navigator.mediaDevices) {
        let mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (mediaStream) {
          this.videoElement.srcObject = mediaStream;
        }
      } else {
        console.log('Your browser does not support media or it`s blocked by security reason.');
      }
    }

  }
  public stop(): void {
    if (this.videoElement) {
      this.videoElement.src = ''
    }
  }
}