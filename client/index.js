import 'whatwg-fetch';
import {PolymerElement, html} from '@polymer/polymer/polymer-element.js';
import '@polymer/paper-button';
import './components/x-image-marker';

// TODO: Add paging to load chunks of samples instead of whole dataset
function fetchDataset(datasetName) {
  return fetch(`/api/v1/dataset/${datasetName}`)
    .then((response) => response.json());
}

function initializeSample(dataset, sample) {
  // cheap deep clone
  sample.features = JSON.parse(JSON.stringify(dataset.features));
  sample.features.forEach((feature) => {
    feature.value = feature.type === 'heatmap'
      ? document.createElement('canvas')
      : [];
  })
}

function serializeSamples(samples) {
  return samples;
}

class XApp extends PolymerElement {
  static get template() {
    return /* language=HTML */ html`
      <style>
        .work-area {
          max-width: 80vw;
          margin: 0 auto;
          display: flex;
          flex-flow: column nowrap;
          align-items: center;
          padding: 14px;
        }
        
        .action-buttons {
          padding: 14px 0;
        }
        
        .next-button {
          width: 100%;
          color: #3a3;
        }

        .toolbar {
          width: 100%;
          display: flex;
          margin: 0 0 14px 0;
        }

        .toolbar .primary-buttons {
          flex-grow: 1;
        }

        .button-danger {
          color: #a33;
        }

        .brush-selector {
          width: 95px;
        }

        .brush-preview {
          margin: 0 5px;
          line-height: 16px;
        }
      </style>

      <div class="work-area">
        <div class="toolbar">
          <div class="primary-buttons">
            <template is="dom-if" if="_isHeatmapMode(drawMode)">
              <paper-dropdown-menu class="brush-selector" no-animations label="Brush">
                <paper-listbox slot="dropdown-content" attr-for-selected="value" selected="{{_heatmapBrush}}">
                  <paper-item value="./brushes/green_10x10.png">
                    <img class="brush-preview" src="./brushes/green_10x10.png"> 10x10
                  </paper-item>

                  <paper-item value="./brushes/green_5x5.png">
                    <img class="brush-preview" src="./brushes/green_5x5.png"> 5x5
                  </paper-item>
                </paper-listbox>
              </paper-dropdown-menu>
            </template>
          </div>

          <div class="secondary-buttons">
            <paper-button raised class="button-danger" on-click="_handleClearClick">Clear</paper-button>
          </div>
        </div>

        <x-image-marker
          id="imageMarker"
          sample="[[_activeSample]]"
          active-feature="[[_activeFeature]]"
          crop-mode="center"
          heatmap-brush="[[_heatmapBrush]]">
        </x-image-marker>
      </div>
    `;
  }

  static get properties() {
    return {
      _datasetName: {
        type: String,
        value: 'iris', // FIXME: Make dataset name selectable
      },
      _dataset: Object,
      _samples: Array,
      _activeSample: {
        type: String,
      },
      _activeSampleIndex: Number,
      _activeFeature: {
        type: Object,
      },
      _heatmapBrush: {
        type: String,
        value: './brushes/green_10x10.png',
      },
    }
  }

  static get observers() {
    return [
      '_observeDatasetName(_datasetName)',
    ];
  }

  connectedCallback() {
    super.connectedCallback();

    document.addEventListener('keydown', e => this._handleKeyDown(e));
  }

  _handleClearClick() {
    this.$.imageMarker.clear();
  }

  _handleKeyDown(event) {
    if (event.code === 'Space') {
      event.preventDefault();
      this._nextSample();
    }
  }

  _observeDatasetName(datasetName) {
    fetchDataset(datasetName).then((dataset) => {
      const activeSample = dataset.samples[0];
      initializeSample(dataset, activeSample);

      this.setProperties({
        _dataset: dataset,
        _activeSample: activeSample,
        _activeSampleIndex: 0,
        _activeFeature: activeSample.features[0],
      });
    });
  }

  _nextSample() {
    const nextSampleIndex = this._activeSampleIndex + 1;
    const sample = this._dataset.samples[nextSampleIndex];

    if (!sample) return;

    initializeSample(this._dataset, sample);

    this.setProperties({
      _activeSample: sample,
      _activeSampleIndex: nextSampleIndex,
      _activeFeature: sample.features[0],
    });
  }
}

// Register the x-custom element with the browser
customElements.define('x-app', XApp);
