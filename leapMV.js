//=============================================================================
// leapMV.js
//=============================================================================

/*:
 * @plugindesc Enable to input with Leap Motion
 * @author Tomoya Chiba
 *
 * @param displayBoneHand
 * @desc Whether to display bone hand. 1:yes 0:no
 * @default 0
 *
 * @param displayDebugDump
 * @desc Whether to display dump of Leap Motion. 1:yes 0:no
 * @default 0
 *
 * @help
 *  TODO
 *
 */

/*:ja
 * @plugindesc Leap Motionを用いて手の動きでゲームを操作できるようにします
 * @author Tomoya Chiba
 *
 * @param displayBoneHand
 * @desc 手のCGを表示するか 1:yes 0:no
 * @default 0
 *
 * @param displayDebugDump
 * @desc Leap Motionのdumpデータを表示するか 1:yes 0:no
 * @default 0
 *
 * @help
 *  人差し指を上下左右に向ける ... 十字キー
 *  画面にタップするようなジェスチャ ... 決定キー
 *  指で時計回りに輪を描くジェスチャ ... 決定キー
 *  指で反時計回りに輪を描くジェスチャ ... キャンセルキー
 *
 */
(function() {
  var parameters = PluginManager.parameters('LeapMV');
  var displayBoneHand = Number(parameters['displayBoneHand'] || 1);
  var displayDebugDump = Number(parameters['displayDebugDump']) != 0;

  var _Input_update = Input.update;
  Input.update = function() {
    if (LeapStateView.instance) LeapStateView.instance.update();
    this.applyLeapState();
    _Input_update.apply(this, arguments);
  };

  Input.applyLeapState = function() {
    var self = this;
    ['left', 'right', 'down', 'up'].forEach(function (direction) {
      if (LeapInputManager.isActive(direction)) {
        self._currentState[direction] = true;
      } else if (LeapInputManager.isStopped(direction)) {
        self._currentState[direction] = false;
      }
    });

    if (LeapInputManager.isActive('screenTap')) {
      this._currentState['ok'] = true;
    } else if (LeapInputManager.isStopped('screenTap')) {
      this._currentState['ok'] = false;
    }

    if (LeapInputManager.isActive('clockwise')) {
      this._currentState['ok'] = true;
    } else if (LeapInputManager.isStopped('clockwise')) {
      this._currentState['ok'] = false;
    }

    if (LeapInputManager.isActive('counterClockwise')) {
      this._currentState['cancel'] = true;
    } else if (LeapInputManager.isStopped('counterClockwise')) {
      this._currentState['cancel'] = false;
    }

    LeapInputManager.saveLastState();
  }

  var _Scene_Boot_start = Scene_Boot.prototype.start;
  Scene_Boot.prototype.start = function() {
    _Scene_Boot_start.apply(this, arguments);
    new LeapStateView();
    appendDebugDump();
    initLeapInput();
  };

  var LeapInputManager = {};
  LeapInputManager.currentState = {};
  LeapInputManager.lastState = {};

  LeapInputManager.saveLastState = function(frame) {
    this.lastState = this.currentState;
    this.currentState = {};
  };

  LeapInputManager.isActive = function(state) {
    return this.currentState[state];
  }

  LeapInputManager.isStarted = function(state) {
    return !this.lastState[state] && this.currentState[state];
  }

  LeapInputManager.isStopped = function(state) {
    return this.lastState[state] && !this.currentState[state];
  }

  LeapInputManager.handleCircle = function(frame, gesture) {
    if (gesture.state == 'stop' && gesture.radius > 15) {
      var pointableID = gesture.pointableIds[0];
      var direction = frame.pointable(pointableID).direction;
      var dotProduct = Leap.vec3.dot(direction, gesture.normal);
      var clockwise = dotProduct > 0;
      if (clockwise) {
        LeapInputManager.currentState['clockwise'] = true;
      } else {
        LeapInputManager.currentState['counterClockwise'] = true;
      }
    }
  }

  LeapInputManager.clearIndexFingerDirection = function() {
    var self = this;
    ['left', 'right', 'down', 'up'].forEach(function(direction) {
      self.currentState[direction] = false;
    });
  };

  LeapInputManager.updateIndexFingerDirection = function(finger, isRight) {
    var x = finger.direction[0];
    var y = finger.direction[1];
    var thresholdPositive = isRight ? 0.45 : 0.4;
    var thresholdNegative = isRight ? - 0.4 : - 0.45;

    if (x > thresholdPositive) { this.currentState['right'] = true; }
    if (x < thresholdNegative) { this.currentState['left'] = true; }
    if (y > thresholdPositive) { this.currentState['up'] = true; }
    if (y < thresholdNegative) { this.currentState['down'] = true; }
  };

  // TODO: Use tkool MV window to show current leap state.
  function LeapStateView() {
    this.el = document.createElement('div');
    this.el.id = 'LeapStateView';
    this.el.style.position = 'absolute';
    this.el.style.zIndex = '22';
    this.el.style.backgroundColor = 'white';
    document.body.appendChild(this.el);
    LeapStateView.instance = this;
  }

  LeapStateView.prototype.value = function() {
    if (LeapInputManager.isActive('left')) return '←';
    if (LeapInputManager.isActive('right')) return '→';
    if (LeapInputManager.isActive('up')) return '↑';
    if (LeapInputManager.isActive('down')) return '↓';

    if (LeapInputManager.isActive('screenTap')) return '◯';
    if (LeapInputManager.isActive('clockwise')) return '◯';
    if (LeapInputManager.isActive('counterClockwise')) return '×';

    return '';
  }

  LeapStateView.prototype.update = function() {
    this.el.innerHTML = this.value();
  };

  function initLeapInput() {
    Leap.loop({ enableGestures: true }, function(frame) {

      frame.gestures.map(function (gesture) {
        switch (gesture.type) {
          case "circle":
            LeapInputManager.handleCircle(frame, gesture);
            break;
          case "screenTap":
            LeapInputManager.currentState['screenTap'] = true;
            break;
        }
      });

      LeapInputManager.clearIndexFingerDirection();
      frame.hands.forEach(function (hand) {
        if (hand.indexFinger) {
          LeapInputManager.updateIndexFingerDirection(hand.indexFinger, hand.type == 'right')
        }
      });

      if (displayDebugDump) {
        debugPrint.innerHTML = frame.dump();
      }
    });

    if (displayBoneHand) {
      Leap.loop().use('boneHand', { targetEl: document.body, arm: true });
      Array.prototype.forEach.call(document.getElementsByClassName('leap-boneHand'), function(el) {
        el.style.position = 'absolute';
        el.style.zIndex = '20';
      });
    }
  }

  if (displayDebugDump) {
    var debugPrint = document.createElement('div');
    debugPrint.id = 'LeapDebugDump';
    debugPrint.style.position = 'absolute';
    debugPrint.style.zIndex = '21';
  }

  function appendDebugDump() {
    if (displayDebugDump) {
      document.body.appendChild(debugPrint);
    }
  }

  function loadScript(url) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = PluginManager._path + url;
    script.async = false;
    document.body.appendChild(script);
  }

  loadScript('leapMV-ext/leap-0.6.4.min.js')

  if (displayBoneHand) {
    loadScript('leapMV-ext/three.r70.min.js')
    loadScript('leapMV-ext/leap-plugins-0.1.11.min.mod.js')
  }
})();
