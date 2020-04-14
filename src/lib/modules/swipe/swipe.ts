import {
  defaultSwipeTrackingConfig, defaultAccumulatorConfig, defaultPrev,
  SwipeTrackingConfig, Accumulator, HandsHistory, PrevPosition,
} from './config';
import { Kp, ActivePose, ActiveKeypoint } from '../touchless.types';
import { Helper } from '../helper'
import { StreamModule } from '../streamModule';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Vector2D, Keypoint } from '@tensorflow-models/posenet/dist/types';

export class SwipeTracking extends StreamModule {

  config: SwipeTrackingConfig;
  prev: PrevPosition;
  activeCenter: Vector2D;
  relativeSize: number;
  handsHistory: HandsHistory;
  _acumulator: Accumulator

  constructor(config?: SwipeTrackingConfig) {
    super()
    this.config = { ...defaultSwipeTrackingConfig, ...config }
    this.prev = defaultPrev
    this._clearAccumulator()
    this.relativeSize = 10
    this.activeCenter = { x: 0, y: 0 }
  }

  public setConfig(config?: SwipeTrackingConfig): void {
    this.config = { ...this.config, ...config }
  }

  public async create() { }

  public operator() {
    return (source: Observable<ActivePose>) =>
      source.pipe(
        map(pose => this.getSwipeData(pose)
        ))
  }

  getSwipeData(pose: ActivePose) {
    if (
      pose !== undefined &&
      Math.abs(this.activeCenter.x - pose.center.x) < this.relativeSize / 2
    ) {
      this.activeCenter = { ...pose.center };
      this.relativeSize = this._getPoseRelativeSize(pose.keypoints)
      this._addToAccumulator(pose.keypoints, 'left', this.relativeSize * 0.1)
      this._addToAccumulator(pose.keypoints, 'right', this.relativeSize * 0.1)
    } else {
      this._popAccumulator()
    }
    return {
      left: this._swipeAccumulator('left', this.relativeSize),
      right: this._swipeAccumulator('right', this.relativeSize)
    }
  }

  private _swipeAccumulator(hand: 'left' | 'right', relativeSize: number) {
    if (!(hand === 'left' || hand === 'right')) return null
    const maxSwipe = Math.max(
      Helper.sumArr(this._acumulator[hand].in),
      Helper.sumArr(this._acumulator[hand === 'left' ? 'right' : 'left'].out),
    )
    if (maxSwipe) {
      let result = maxSwipe / relativeSize
      if (result >= 1) {
        result = 1
        this._clearAccumulator()
      }
      return result
    } else {
      return 0
    }
  }

  private _popAccumulator(hand?: 'left' | 'right') {
    if (hand) {
      this._acumulator[hand].in.pop()
      this._acumulator[hand].out.pop()
    } else {
      this._popAccumulator('left')
      this._popAccumulator('right')
    }
  }

  private _clearAccumulator(hand?: 'left' | 'right') {
    if (hand) {
      this._acumulator[hand] = defaultAccumulatorConfig[hand]
    } else {
      this._acumulator = defaultAccumulatorConfig
    }
  }

  private _addToAccumulator(keypoints: ActiveKeypoint[], hand: 'left' | 'right', minMovement: number) {
    if (!(hand === 'left' || hand === 'right')) return null
    const accumulator = this._acumulator[hand]
    if (this.prev[hand + 'Wrist'].x) {
      const swipe = this._swipeDir(keypoints, hand, minMovement)
      if (swipe === null) {
        this._popAccumulator(hand)
      } else {
        accumulator[swipe.dir].unshift(swipe.size)
        accumulator[swipe.dir === 'in' ? 'out' : 'in'].pop()
        if (accumulator[swipe.dir].length > 9) accumulator[swipe.dir].pop()
      }
    }
    this.prev[hand + 'Wrist'] = { ...keypoints[Kp[hand + 'Wrist']].position }
  }

  private _getPoseRelativeSize(keypoints: ActiveKeypoint[]) {
    return Math.max(
      Helper.getKeypointsDistanse([keypoints[Kp.leftShoulder], keypoints[Kp.leftElbow]]),
      Helper.getKeypointsDistanse([keypoints[Kp.rightShoulder], keypoints[Kp.rightElbow]]),
      Helper.getKeypointsDistanse([keypoints[Kp.leftShoulder], keypoints[Kp.rightShoulder]]),
    )
  }

  private _swipeDir(keypoints: ActiveKeypoint[], hand: 'left' | 'right', minMovement: number) {
    if (
      !(hand === 'left' || hand === 'right') ||
      !keypoints[Kp[hand + 'Wrist']].isActive
    ) return null

    let dir = ''
    const sign = hand === 'left' ? 1 : -1
    const shoulder = keypoints[Kp[hand + 'Shoulder']].position
    const wrist = keypoints[Kp[hand + 'Wrist']].position
    const swipeSize = this.prev[hand + 'Wrist'].x - wrist.x
    const movement = Math.abs(swipeSize)
    const isActive = true
    if (!isActive && movement < minMovement) return null
    if (swipeSize * sign >= 0) {
      dir = 'in'
    } else {
      if (hand === 'left') {
        if (shoulder.x + minMovement < wrist.x) {
          dir = 'out'
        } else return null
      } else {
        if (shoulder.x - minMovement > wrist.x) {
          dir = 'out'
        } else return null
      }
    }
    return { dir, size: movement }
  }
}
