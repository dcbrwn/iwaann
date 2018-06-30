import {PolymerElement, html} from '@polymer/polymer/polymer-element.js';
import '@polymer/neon-animation/neon-animations';
import '@polymer/paper-dropdown-menu/paper-dropdown-menu';
import '@polymer/paper-listbox';
import '@polymer/paper-item/paper-item';
import '@polymer/paper-button';

function distance(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return Math.sqrt(dx * dx + dy * dy);
}

function lerp(min, max, value) {
  return min + (max - min) * value;
}

function* lerp2d(x0, y0, x1, y1, step) {
  const dist = distance(x0, y0, x1, y1);
  const normalizedStep = step / dist;

  for (let i = 0; i <= 1; i += normalizedStep) {
    yield [
      lerp(x0, x1, i),
      lerp(y0, y1, i),
    ];
  }
}

function canvasToImageCoord(canvas, cx, cy) {
  return [
    canvas.width / canvas.offsetWidth * cx,
    canvas.height / canvas.offsetHeight * cy,
  ];
}

class XApp extends PolymerElement {
  static get template() {
    return /* language=HTML */ html`
      <style>
        :host {
          display: block;
          position: relative;
        }

        #canvas {
          max-width: 100%;
          cursor: crosshair;
          position: relative;
          transition: opacity 0.1s linear;
        }
        
        #canvas.busy {
          pointer-events: none;
          opacity: 0.3;
        }
      </style>
      
      <canvas
        id="canvas"
        class$="[[_getCanvasClass(_isBusy)]]"
        on-mousedown="_handleMouseDown"
        on-mouseclick="_handleMouseClick">
      </canvas>
    `;
  }

  static get properties() {
    return {
      sample: String,
      activeFeature: Object,
      features: Array,
      heatmapBrush: {
        type: Object,
        value: './brushes/green_10x10.png',
      },
      cropMode: String,
      viewMode: String,

      _isBusy: {
        type: Boolean,
        value: false,
      },
      _ctx: Object,
      _sourceImage: Object,
      _heatmapBrush: Object,
    };
  }

  static get observers() {
    return [
      '_observeSample(sample)',
      '_observeBrush(heatmapBrush)',
      '_observeActiveFeature(activeFeature, _sampleImage)',
    ]
  }

  _observeSample(sample) {
    this.setProperties({
      _isBusy: true,
      _sampleImage: null,
    });

    const image = document.createElement('img');

    image.onload = () => {
      this.$.canvas.width = image.width;
      this.$.canvas.height = image.height;

      if (this.activeFeature && this.activeFeature.type === 'heatmap') {
        this.activeFeature.value.width = image.width;
        this.activeFeature.value.height = image.height;
      }

      this.setProperties({
        _isBusy: false,
        _sampleImage: image,
      });
      this._render();
    };
    image.src = sample.file;
  }

  _observeBrush(brush) {
    if (typeof brush === 'string') {
      this.setProperties({
        _isBusy: true,
        _heatmapBrush: null,
      });

      const image = document.createElement('img');

      image.onload = () => {
        this.setProperties({
          _isBusy: false,
          _heatmapBrush: image,
        });
      };
      image.src = brush;
    }
  }

  _observeActiveFeature(feature, sampleImage) {
    if (this._suppressDataObserver) return;

    if (sampleImage && feature.type === 'heatmap' && feature.value) {
      feature.value.width = sampleImage.width;
      feature.value.height = sampleImage.height;
    }

    this._render();
  }

  connectedCallback() {
    super.connectedCallback();
    this.$.canvas.width = this.canvasWidth;
    this.$.canvas.height = this.canvasHeight;
    this._ctx = this.$.canvas.getContext('2d');
  }

  _updateData() {
    this._suppressDataObserver = true;
    this.data = Object.assign({}, this.data);
    this._suppressDataObserver = false;
  }

  _render() {
    if (!this._ctx) return;

    const ctx = this._ctx;

    if (this._sampleImage) {
      // TODO: Apply crop mode
      ctx.drawImage(this._sampleImage, 0, 0);
    }

    if (this.activeFeature && this.activeFeature.type === 'heatmap') {
      ctx.drawImage(this.activeFeature.value, 0, 0);
    }
  }

  _handleMouseDown(event) {
    event.preventDefault();
    if (!this.activeFeature) return;

    switch(this.activeFeature.type) {
      case 'heatmap':
        if (this._heatmapBrush && this.activeFeature.value) {
          this._handleHeatmapDrawStart(event);
        }
        break;
    }
  }

  _handleMouseClick(event) {
    event.preventDefault();
  }

  _handleHeatmapDrawStart(event) {
    if (!this._heatmapBrush) return;

    const ctx = this.activeFeature.value.getContext('2d');
    const brush = this._heatmapBrush;

    let offsetX = event.offsetX - event.pageX;
    let offsetY = event.offsetY - event.pageY;
    let [x0, y0] = canvasToImageCoord(this.$.canvas, event.offsetX, event.offsetY);
    ctx.drawImage(brush, x0 - brush.width / 2, y0 - brush.height / 2);
    this._render();

    const onMove = (event) => {
      const [x1, y1] = canvasToImageCoord(this.$.canvas, event.pageX + offsetX, event.pageY + offsetY);

      for (let [x, y] of lerp2d(x0, y0, x1, y1, brush.width / 2)) {
        ctx.drawImage(brush, x - brush.width / 2, y - brush.height / 2);
      }

      [x0, y0] = [x1, y1];

      this._notifyDataUpdated();
      this._render();
    };

    const onEnd = (event) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
  }

  clear() {
    if (this.activeFeature && this.activeFeature.type === 'heatmap') {
      const heatmap = this.activeFeature.value;
      const ctx = heatmap.getContext('2d');
      ctx.clearRect(0, 0, heatmap.width, heatmap.height);
      this._render();
    }
  }

  _notifyDataUpdated() {
    this.dispatchEvent(new CustomEvent('data-updated', {
      bubbles: true,
      composed: true,
    }));
  }

  _getCanvasClass(isBusy) {
    return isBusy ? 'busy' : '';
  }
}

// Register the x-custom element with the browser
customElements.define('x-image-marker', XApp);
