(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = {
  _callbacks: {},
  subscribeAll: function subscribeAll(callbacksMap) {
    if (callbacksMap === null || typeof callbacksMap !== 'object') {
      return;
    }
    for (var name in callbacksMap) {
      if (callbacksMap.hasOwnProperty(name)) {
        this.subscribe(name, callbacksMap[name]);
      }
    }
  },
  subscribe: function subscribe(name, callback) {
    this._callbacks[name] = callback;
  },
  trigger: function trigger(event) {
    var fn = this._callbacks[event] || function () {};

    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    fn.apply(null, args);
  }
};

},{}],2:[function(require,module,exports){
'use strict';

var _require = require('./config');

var scriptElem = _require.scriptElem;
var unitContext = _require.unitContext;
var CHECK_INTERVAL = _require.CHECK_INTERVAL;

var OpportinityChecker = require('../../utils/opportunity_checker');
var isVisible = require('../../utils/is_visible');

var VIEWABILITY_MAP = {
  viewable: 1,
  unviewable: 0,
  unmeasurable: -1
};

module.exports = {
  onRemove: function onRemove() {
    clearTimeout(this.visibility_checker);
  },
  startOpportunityChecker: function startOpportunityChecker(widget) {
    var checker = OpportinityChecker.create({
      widgetParams: widget.params,
      onlyProd: true,
      scriptTag: scriptElem.get(0),
      onInit: function onInit() {
        widget.rubicon_tracker.track('page_load');
      },
      onInView: function onInView() {
        widget.rubicon_tracker.track('ad_opportunity');
      }
    });
    if (checker) {
      window.VIROOL_OPCHECKER = checker;
      checker.startChecking();
    }
  },
  runVisibilityChecker: function runVisibilityChecker(widget) {
    var _this = this;

    this.visibility_checker = setTimeout(function () {
      var _widget$viewability$checkViewability = widget.viewability.checkViewability(unitContext);

      var percentViewable = _widget$viewability$checkViewability.percentViewable;
      var viewabilityState = _widget$viewability$checkViewability.viewabilityState;

      widget.send({ type: 'update_visibility', percentViewable: percentViewable, viewabilityState: VIEWABILITY_MAP[viewabilityState] });
      _this.runVisibilityChecker(widget);
    }, CHECK_INTERVAL);
  },
  runAnchorChecker: function runAnchorChecker(widget, sendPlayTracking) {
    var _this2 = this;

    this.anchor_checker = setTimeout(function () {
      if (widget.player_ready && isVisible(widget.anchor.get(0), unitContext)) {
        widget.showUnit();
        widget.send({ type: 'play' });
        sendPlayTracking();
      } else {
        _this2.runAnchorChecker(widget, sendPlayTracking);
      }
    }, CHECK_INTERVAL);
  }
};

},{"../../utils/is_visible":10,"../../utils/opportunity_checker":13,"./config":3}],3:[function(require,module,exports){
'use strict';

var CurrentScript = require('../../utils/current_script');
var uuid = require('../../utils/uuid');
var PostMessageManager = require('../../utils/post_message');
var $ = require('../../vendor/jquery');

exports.CHECK_INTERVAL = 500;
exports.MIN_WIDTH = 260;
exports.isFriendlyIframe = (function () {
  try {
    return window.top !== window.self && window.top.document != null;
  } catch (_error) {
    return false;
  }
})();
exports.unitContext = exports.isFriendlyIframe ? window.top : window.self;
exports.selfContext = window.self;
exports.viroolParams = window.viroolWidgetSettings || {};
exports.currentScript = $(CurrentScript.find('backfill.loader'));

exports.REGION = window.VIROOL_REG || "unknown";
exports.CONFIG_KEY = window.VIROOL_KEY || "unknown";
exports.VIROOL_SITE_ID = window.VIROOL_SITE_ID || "unknown";
exports.DOMAIN = (function (context, scriptTag) {
  var tmp = "";
  if (scriptTag.length) {
    try {
      tmp = scriptElem.attr('src').match(/domain=([^&]+)/);
      if (tmp[1]) {
        return tmp[1];
      }
    } catch (err) {
      // no error processor
    }
  }
  return context.document.domain.replace(/www\d*\./, '');
})(exports.unitContext, exports.currentScript);

exports.postMessage = new PostMessageManager(exports.unitContext);

exports.sessId = uuid();
exports.scriptElem = exports.currentScript;
exports.templateHost = (function () {
  if (exports.currentScript.length) {
    try {
      var a = document.createElement('a');
      a.href = exports.currentScript.attr('src');
      var hostname = a.hostname;
      var port = a.port;

      return hostname + (port ? ':' + port : '');
    } catch (err) {
      // no error processor
    }
  }
  return;
})();

exports.DEFAULT_PARAMS = {
  template_host: exports.templateHost || 'battleunits.s3.amazonaws.com',
  src: '/backfill.widget.%kind%.html',
  width: 640,
  height: 400,
  friendly: true,
  nologo: false,
  no_close_button: false,
  hydraMode: false,
  is_mobile: false,
  or: exports.unitContext.location.href
};

exports.WIDGET_CONFIG_KEYS = ['hydraMode', 'nologo', 'no_close_button', 'is_mobile', 'or', 'silent', 'friendly', 'width', 'height', 'elem', 'spotx_vpaid', 'vast', 'b64Vast', 'vastTag', 'campaignId', 'siteKey', 'desktop_fallback', 'skey'];

},{"../../utils/current_script":9,"../../utils/post_message":15,"../../utils/uuid":19,"../../vendor/jquery":21}],4:[function(require,module,exports){
'use strict';

var _require = require('./config');

var sessId = _require.sessId;
var DOMAIN = _require.DOMAIN;

var _ = require('../../utils/lambda');
var bowser = require('bowser');

var started = Date.now();

var EVENT_COUNT = 'events:*event#incr';
var EVENT_COUNT_BY_SITE = 'events_by_site:*site_id:*event#incr';
var EVENT_TIME = 'timings:*event:time/*time#incrby';

var TYPE_COUNT = 'type_options/*type/1#hincrby';
var BY_SITE_TYPE_COUNT = 'by_site_type_options:*site_id/*type/1#hincrby';

var REGIONS_EVENTS_COUNT = 'regions_events:*region:*event#incr';
var EVENTS_REGIONS_COUNT = 'events_regions:*event:*region#incr';

var REGION_TIME = 'region_timings:*event:*region/*time#lpush';
var BY_SITE_TIME = 'by_site_timings:*event:*site_id/*time#lpush';

var EVENT_DOMAIN_COUNT = 'by_site:*event/*site_id/1#hincrby';
var EVENT_DOMAIN_TIME = 'by_site_time:*event/*site_id/*time#hincrby';

var PREFIX = window.VIROOL_BU_TRACKER_PREFIX || 'battleunits';

var additional_commands = {
  'type': [TYPE_COUNT, BY_SITE_TYPE_COUNT],
  'start_loading': [REGIONS_EVENTS_COUNT, EVENTS_REGIONS_COUNT, REGION_TIME, BY_SITE_TIME, EVENT_DOMAIN_COUNT, EVENT_DOMAIN_TIME],
  'ready': [EVENT_DOMAIN_COUNT, EVENT_DOMAIN_TIME, REGIONS_EVENTS_COUNT, REGION_TIME, BY_SITE_TIME],
  'play': [EVENT_DOMAIN_COUNT, REGIONS_EVENTS_COUNT, REGION_TIME, BY_SITE_TIME],
  'load_mobile': [REGION_TIME],
  'load_desktop': [REGION_TIME]
};

var send_tracking = function send_tracking(e, uid, data) {
  //FIX for some Android devices: http://stackoverflow.com/questions/35267706/js-date-returns-null-for-some-android-devices
  //if(!started){
  //  return;
  //}
  var url;
  if (data == null) {
    data = {};
  }
  url = "//nestor.virool.com/pixel?event=" + e + "&key=" + uid + "&source=" + PREFIX + "&data=";
  return _track_url(url + encodeURIComponent(JSON.stringify(data)));
};

var _track_url = function _track_url(url) {
  return new Image().src = url;
};

module.exports = {
  _track_url: _track_url,
  track: function track(event) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
    var commands = arguments.length <= 2 || arguments[2] === undefined ? [EVENT_COUNT, EVENT_COUNT_BY_SITE] : arguments[2];

    commands = commands.concat(additional_commands[event] || []);
    send_tracking(event, sessId, _.extend({}, {
      event: event,
      ua: window.navigator.userAgent,
      bowser: bowser.name.replace(/\s+/g, '_'),
      domain: DOMAIN,
      time: Date.now() - started,
      since_begin: Date.now() - started,
      _: commands
    }, options));
  }
};

},{"../../utils/lambda":11,"./config":3,"bowser":23}],5:[function(require,module,exports){
'use strict';

var _require = require('./config');

var unitContext = _require.unitContext;

var _require2 = require('../../utils/ass_asset');

var OpenVV = _require2.OpenVV;
var OVVAsset = _require2.OVVAsset;

var $ = require('../../vendor/jquery');

var _require3 = require('./config');

var MIN_WIDTH = _require3.MIN_WIDTH;

var TEMPLATES = {
  'cover': "<!DOCTYPE html>\n<html>\n<head>\n<!-- build:css widget.backfill.css -->\n<link rel=\"stylesheet\" href=\"/widget.backfill.css\">\n<!-- endbuild -->\n</head>\n<body>\n<div role='widget-container' class='backfill' id='backfill'>\n    <div id='player_container'></div>\n    <div class=\"stuff-box\">\n      <div class=\"icon-wrapper\" id=\"logo_wrapper\">\n        <a href=\"https://www.virool.com/inline\" target=\"_blank\"><div class=\"icon virool-logo-icon\"></div></a>\n        <div class=\"icon-tooltip icon-virool\">inLine by Virool</div>\n      </div>\n      <div class=\"icon-wrapper\" id=\"close_button_wrapper\">\n        <div id=\"close_button\" class=\"icon wicon-x\"></div>\n        <div class=\"icon-tooltip\">Close</div>\n      </div>\n    </div>\n    <style type=\"text/css\" id=\"custom_styles\"></style>\n</div>\n\n\n<link rel=\"stylesheet\" href=\"https://d12d2xrvpdxyek.cloudfront.net/main.css\">\n<script src=\"https://virool-cover.s3.amazonaws.com/patterns.js\"></script>\n<script src=\"https://d12d2xrvpdxyek.cloudfront.net/bundle.js\"></script>\n\n<!-- build:js widget.backfill.js -->\n<script src=\"/widget.backfill.js\" type=\"text/javascript\"></script>\n<!-- endbuild -->\n</body>\n</html>\n",
  'desktop': "<!DOCTYPE html>\n<html>\n<head>\n<!-- build:css widget.backfill.css -->\n<link rel=\"stylesheet\" href=\"/widget.backfill.css\">\n<!-- endbuild -->\n<link rel=\"stylesheet\" type=\"text/css\" href=\"//d5frjulruv2gm.cloudfront.net/vsap/vsap.css\">\n</head>\n<body>\n<div role='widget-container' class='backfill' id='backfill'>\n    <div id='player_container'></div>\n    <div class=\"stuff-box\">\n      <div class=\"icon-wrapper\" id=\"logo_wrapper\">\n        <a href=\"https://www.virool.com/inline\" target=\"_blank\"><div class=\"icon virool-logo-icon\"></div></a>\n        <div class=\"icon-tooltip icon-virool\">inLine by Virool</div>\n      </div>\n      <div class=\"icon-wrapper\" id=\"close_button_wrapper\">\n        <div id=\"close_button\" class=\"icon wicon-x\"></div>\n        <div class=\"icon-tooltip\">Close</div>\n      </div>\n    </div>\n    <style type=\"text/css\" id=\"custom_styles\"></style>\n</div>\n\n\n<script type=\"text/javascript\" src='//d5frjulruv2gm.cloudfront.net/vsap/vsap.min.js'></script>\n\n<!-- build:js widget.backfill.js -->\n<script src=\"/widget.backfill.js\" type=\"text/javascript\"></script>\n<!-- endbuild -->\n</body>\n</html>\n",
  'desktop_fallback': "<!DOCTYPE html>\n<html>\n<head>\n<!-- build:css widget.backfill.css -->\n<link rel=\"stylesheet\" href=\"/widget.backfill.css\">\n<!-- endbuild -->\n<link rel=\"stylesheet\" type=\"text/css\" href=\"//d5frjulruv2gm.cloudfront.net/vsap/vsap.css\">\n</head>\n<body>\n<div role='widget-container' class='backfill' id='backfill'>\n    <div id='player_container'></div>\n    <div class=\"stuff-box\">\n      <div class=\"icon-wrapper\" id=\"logo_wrapper\">\n        <a href=\"https://www.virool.com/inline\" target=\"_blank\"><div class=\"icon virool-logo-icon\"></div></a>\n        <div class=\"icon-tooltip icon-virool\">inLine by Virool</div>\n      </div>\n      <div class=\"icon-wrapper\" id=\"close_button_wrapper\">\n        <div id=\"close_button\" class=\"icon wicon-x\"></div>\n        <div class=\"icon-tooltip\">Close</div>\n      </div>\n    </div>\n    <style type=\"text/css\" id=\"custom_styles\"></style>\n</div>\n\n\n<script type=\"text/javascript\" src='//d5frjulruv2gm.cloudfront.net/vsap/vsap.min.js'></script>\n\n\n<!-- build:js widget.backfill.js -->\n<script src=\"/widget.backfill.js\" type=\"text/javascript\"></script>\n<!-- endbuild -->\n</body>\n</html>\n"
};

var getActualWidthHeight = function getActualWidthHeight(widget) {
  var ratio = widget.params.height / widget.params.width;
  var containerWidth = parseInt(widget.container.parent().css('width'));
  var widthOption = widget.params.percent_width ? parseInt(widget.params.percent_width) * containerWidth / 100 : containerWidth;
  var width = Math.min(Math.max(widthOption, MIN_WIDTH), widget.params.width);
  var height = Math.min(width * ratio, widget.params.height);
  return { width: width, height: height };
};

var adLabelHTML = function adLabelHTML(widget) {
  if (!!widget.params.widget_label) {
    return '<p style=\'color:rgb(102,102,102);font-size:11px;text-align:center;margin-bottom:5px;\'>\n        ' + widget.params.widget_label + '\n      </p>';
  } else {
    return '';
  }
};
var wrapperHTML = function wrapperHTML(widget, params) {
  return '\n    <div id=\'' + params.anchorId + '\' style=\'width:1px;height:1px;background:transparent;margin:0;padding:0;\'></div>\n    <div id=\'' + params.containerId + '\' style=\'margin:0;padding:0;position:absolute;overflow:hidden;left:-9999px;\'>\n    ' + adLabelHTML(widget) + '\n    <iframe id=\'' + params.iframeId + '\'></iframe>\n    </div>\n    <div id=\'' + params.passbackId + '\' style=\'display:none;margin:0;padding:0;\'></div>\n  ';
};

var cleanupSimilarUnits = function cleanupSimilarUnits() {
  var _this = this;

  var pageUnits = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];

  $.each(pageUnits, function (ind, unit) {
    // remove all units placed to the same place on page
    if (!unit.unit_removed && unit.adSlot && unit.adSlot.length && _this.id !== unit.id && _this.adSlot.get(0) === unit.adSlot.get(0)) {
      unit.removeUnit();
    }
  });
};

var templateKind = function templateKind(widget) {
  return widget.params.is_mobile ? 'cover' : widget.params.desktop_fallback ? 'desktop_fallback' : 'desktop';
};

var iframeSrc = function iframeSrc(widget) {
  return ('//' + widget.params.template_host + widget.params.src + '?id=' + widget.id).replace('%kind%', templateKind(widget));
};

module.exports = {
  cleanAppend: function cleanAppend(widget) {
    var pageUnits = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

    cleanupSimilarUnits(pageUnits);

    var anchorId = 'anchor_' + widget.id;
    var containerId = 'container_' + widget.id;
    var iframeId = 'frame_' + widget.id;
    var passbackId = 'passback-' + widget.id;

    widget.elem[widget.renderPosition](wrapperHTML(widget, { anchorId: anchorId, containerId: containerId, iframeId: iframeId, passbackId: passbackId }));
    widget.anchor = $('#' + anchorId, unitContext.document);
    widget.container = $('#' + containerId, unitContext.document);
    widget.iframe = $('#' + iframeId, unitContext.document);
    widget.passback = $('#' + passbackId, unitContext.document);

    if (widget.params.responsive || widget.params.percent_width) {
      var size = getActualWidthHeight(widget);
      widget.params.width = size.width;
      widget.params.height = size.height;

      $(unitContext).on('resize', function () {
        var size = getActualWidthHeight(widget);
        widget.iframe.attr({
          width: size.width,
          height: size.height
        });
        widget.iframe.css({ width: size.width, height: size.height });
        widget.send({ type: 'resize', size: size });
      });
    }

    if (widget.params.friendly) {
      //$.get(iframeSrc(widget)).done((html) => {
      var html = TEMPLATES[templateKind(widget)];
      var iframe_attrs = {
        marginwidth: '0',
        marginheight: '0',
        scrolling: 'no',
        frameborder: '0',
        width: widget.params.width,
        height: widget.params.height
      };
      if (widget.params.aligncenter) {
        iframe_attrs.style = 'display:block;margin:0 auto;';
      }
      widget.iframe.attr(iframe_attrs);
      widget.iframe.css({ width: widget.params.width, height: widget.params.height });
      var frame_content = html.replace(/\/?(widget\.backfill\.\w+)/g, '//' + widget.params.template_host + '/$1');
      if (widget.params.custom_styles) {
        frame_content = frame_content.replace(/custom_styles"></, 'custom_styles">' + widget.params.custom_styles + '<');
      }
      widget.iframe.get(0).contentWindow.document.open();
      widget.iframe.get(0).contentWindow.document.write(frame_content);
      widget.iframe.get(0).contentWindow.document.close();
      widget.iframe.get(0).contentWindow.widget_id = widget.id;
      //});
    } else {
        widget.iframe.attr(_.extend({}, widget.params, { src: iframeSrc(widget) }));
      }

    OpenVV.addAsset(new OVVAsset(widget.id, {}, widget.iframe.get(0)));
    widget.viewability = OpenVV.getAssetById(widget.id);
  }
};

},{"../../utils/ass_asset":8,"../../vendor/jquery":21,"./config":3}],6:[function(require,module,exports){
'use strict';

var PlacementManager = require('../../utils/placement_manager');
var log = require('../../utils/log');

var _require = require('./event_tracker');

var track = _require.track;

var _require2 = require('./config');

var unitContext = _require2.unitContext;
var scriptElem = _require2.scriptElem;
var viroolParams = _require2.viroolParams;

module.exports = function (widget, onResolved) {
  PlacementManager.findPlacement(unitContext, scriptElem.get(0), widget.params, viroolParams, onResolved);
};

},{"../../utils/log":12,"../../utils/placement_manager":14,"./config":3,"./event_tracker":4}],7:[function(require,module,exports){
'use strict';

var _require = require('./config');

var DOMAIN = _require.DOMAIN;

var log = require('../../utils/log');
var _ = require('../../utils/lambda');
var bowser = require('bowser');
var urltools = require('../../utils/url_tools');

var BROWSER = bowser.name.replace(/\s+/g, '_') + "--" + bowser.version;
var URL_BASE = '//rb-validation.virool.com/event';
var DEFAULT_PARAMS = {
  browser: BROWSER,
  domain: DOMAIN
};

// tracking params holder.
var trackParams;

module.exports = {
  setParams: function setParams(params) {
    trackParams = {
      site_id: params['rubicon_site_id'],
      embed_key: params['embed_key']
    };
  },
  track: function track(eventType) {
    var additional = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    if (!!trackParams) {
      new Image().src = URL_BASE + '?' + urltools.toQueryString(_.extend({ type: eventType }, additional, DEFAULT_PARAMS, trackParams));
    } else {
      log('can\'t track rubicon event: ' + eventType + '! trackings params not set');
    }
  }
};

},{"../../utils/lambda":11,"../../utils/log":12,"../../utils/url_tools":18,"./config":3,"bowser":23}],8:[function(require,module,exports){
(function() {
  var OVV, OVVAsset, OVVCheck, OVVGeometryViewabilityCalculator, VIROOL;
  VIROOL = {};

  /**
  * A container for all OpenVV instances running on the page
  * @class
  * @constructor
   */
  OVV = function() {
    var PREVIOUS_EVENTS_CAPACITY, assets, contains, getBrowserDetailsByUserAgent, getCurrentTime, getServingScenarioType, previousEvents, runSafely, subscribers, userAgent;
    this.DEBUG = false;

    /**
    * Whether OpenVV is running within an iframe or not.
    * @type {Boolean}
     */
    this.IN_IFRAME = window.top !== window.self;

    /**
    * The last asset added to OVV. Useful for easy access from the
    * JavaScript console.
    * @type {OVVAsset}
     */
    this.asset = null;
    userAgent = window.testOvvConfig && window.testOvvConfig.userAgent ? window.testOvvConfig.userAgent : navigator.userAgent;

    /**
    * Returns an object that contains the browser name, version and id {@link OVV#browserIDEnum}
    * @param {ua} userAgent
     */
    getBrowserDetailsByUserAgent = function(ua) {
      var dataBrowsers, getData;
      getData = function() {
        var brverRes, data, dataString, i, replaceStr;
        data = {
          ID: 0,
          name: '',
          version: ''
        };
        dataString = ua;
        i = 0;
        while (i < dataBrowsers.length) {
          if (dataString.match(new RegExp(dataBrowsers[i].brRegex)) !== null) {
            data.ID = dataBrowsers[i].id;
            data.name = dataBrowsers[i].name;
            if (dataBrowsers[i].verRegex === null) {
              break;
            }
            brverRes = dataString.match(new RegExp(dataBrowsers[i].verRegex + '[0-9]*'));
            if (brverRes !== null) {
              replaceStr = brverRes[0].match(new RegExp(dataBrowsers[i].verRegex));
              data.version = brverRes[0].replace(replaceStr[0], '');
            }
            break;
          }
          i++;
        }
        return data;
      };
      dataBrowsers = [
        {
          id: 4,
          name: 'Opera',
          brRegex: 'OPR|Opera',
          verRegex: '(OPR/|Version/)'
        }, {
          id: 1,
          name: 'MSIE',
          brRegex: 'MSIE|Trident/7.*rv:11|rv:11.*Trident/7',
          verRegex: '(MSIE |rv:)'
        }, {
          id: 2,
          name: 'Firefox',
          brRegex: 'Firefox',
          verRegex: 'Firefox/'
        }, {
          id: 3,
          name: 'Chrome',
          brRegex: 'Chrome',
          verRegex: 'Chrome/'
        }, {
          id: 5,
          name: 'Safari',
          brRegex: 'Safari|(OS |OS X )[0-9].*AppleWebKit',
          verRegex: 'Version/'
        }
      ];
      return getData();
    };
    this.browserIDEnum = {
      MSIE: 1,
      Firefox: 2,
      Chrome: 3,
      Opera: 4,
      safari: 5
    };

    /**
    * browser:
    * {
    *   ID: ,
    *     name: '',
    *     version: ''
    * };
     */
    this.browser = getBrowserDetailsByUserAgent(userAgent);
    this.servingScenarioEnum = {
      OnPage: 1,
      SameDomainIframe: 2,
      CrossDomainIframe: 3
    };
    getServingScenarioType = function(servingScenarioEnum) {
      var e, error;
      try {
        if (window.top === window) {
          return servingScenarioEnum.OnPage;
        } else if (window.top.document.domain === window.document.domain) {
          return servingScenarioEnum.SameDomainIframe;
        }
      } catch (error) {
        e = error;
      }
      return servingScenarioEnum.CrossDomainIframe;
    };
    this.servingScenario = getServingScenarioType(this.servingScenarioEnum);

    /**
    * The interval in which ActionScript will poll OVV for viewability
    * information
    * @type {Number}
     */
    this.interval = 1;

    /**
    * An object for storing OVVAssets. {@link OVVAsset}s are stored with their
    * id as the key and the OVVAsset as the value.
    * @type {Object}
     */
    assets = {};

    /**
    * An array for storing the first PREVIOUS_EVENTS_CAPACITY events for each event type. {@see PREVIOUS_EVENTS_CAPACITY}
    * @type {Array}
     */
    previousEvents = [];

    /**
    * Number of event to store
    * @type {int}
     */
    PREVIOUS_EVENTS_CAPACITY = 1000;

    /**
    * An array that holds all the subscribes for a eventName+uid combination
    * @type {Array}
     */
    subscribers = [];

    /**
    * Stores an asset which can be retrieved later using
    * {@link OVV#getAssetById}. The latest asset added to OVV can also be
    * retrieved via the {@link OVV#asset} property.
    * @param {OVVAsset} ovvAsset An asset to observe
     */
    this.addAsset = function(ovvAsset) {
      if (!assets.hasOwnProperty(ovvAsset.getId())) {
        assets[ovvAsset.getId()] = ovvAsset;
        this.asset = ovvAsset;
      }
    };

    /**
    * Removes an {@link OVVAsset} from OVV.
    * @param {OVVAsset} ovvAsset An {@link OVVAsset} to remove
     */
    this.removeAsset = function(ovvAsset) {
      delete assets[ovvAsset.getId()];
    };

    /**
    * Retrieves an {@link OVVAsset} based on its ID
    * @param {String} The id of the element to retrieve
    * @returns {OVVAsset|null} The element matching the given ID, or null if
    * one could not be found
     */
    this.getAssetById = function(id) {
      return assets[id];
    };

    /**
    * @returns {Object} Object an object containing all of the OVVAssets being tracked
     */
    this.getAds = function() {
      var copy, id;
      copy = {};
      for (id in assets) {
        if (assets.hasOwnProperty(id)) {
          copy[id] = assets[id];
        }
      }
      return copy;
    };

    /**
    * Subscribe the {func} to the list of {events}. When getPreviousEvents is true all the stored events that were passed will be fired
    * in a chronological order
    * @param {events} array with all the event names to subscribe to
    * @param {uid} asset identifier
    * @param {func} a function to execute once the assert raise the event
    * @param {getPreviousEvents} if true all buffered event will be triggered
     */
    this.subscribe = function(events, uid, func, getPreviousEvents) {
      var key;
      if (getPreviousEvents) {
        for (key in previousEvents[uid]) {
          key = key;
          if (contains(previousEvents[uid][key].eventName, events)) {
            runSafely(function() {
              func(uid, previousEvents[uid][key]);
            });
          }
        }
      }
      for (key in events) {
        key = key;
        if (!subscribers[events[key] + uid]) {
          subscribers[events[key] + uid] = [];
        }
        subscribers[events[key] + uid].push({
          Func: func
        });
      }
    };

    /**
    * Publish {eventName} to all the subscribers. Also, storing the publish event in a buffered array is the capacity wasn't reached
    * @param {eventName} name of the event to publish
    * @param {uid} asset identifier
    * @param {args} argument to send to the published function
     */
    this.publish = function(eventName, uid, args) {
      var eventArgs, funcObject, i;
      eventArgs = {
        eventName: eventName,
        eventTime: getCurrentTime(),
        ovvArgs: args
      };
      if (!previousEvents[uid]) {
        previousEvents[uid] = [];
      }
      if (previousEvents[uid].length < PREVIOUS_EVENTS_CAPACITY) {
        previousEvents[uid].push(eventArgs);
      }
      if (eventName && uid && subscribers[eventName + uid] instanceof Array) {
        i = 0;
        while (i < subscribers[eventName + uid].length) {
          funcObject = subscribers[eventName + uid][i];
          if (funcObject && funcObject.Func && typeof funcObject.Func === 'function') {
            runSafely(function() {
              funcObject.Func(uid, eventArgs);
            });
          }
          i++;
        }
      }
    };
    getCurrentTime = function() {
      'use strict';
      if (Date.now) {
        return Date.now();
      }
      return (new Date).getTime();
    };
    contains = function(item, list) {
      var i;
      i = 0;
      while (i < list.length) {
        if (list[i] === item) {
          return true;
        }
        i++;
      }
      return false;
    };
    runSafely = function(action) {
      var e, error, ret;
      try {
        ret = action();
        if (ret !== void 0) {
          return ret;
        } else {
          return true;
        }
      } catch (error) {
        e = error;
        return false;
      }
    };
  };

  /**
  * A container for all the values that OpenVV collects.
  * @class
  * @constructor
   */
  OVVCheck = function() {

    /**
    * The height of the viewport
    * @type {Number}
     */
    this.clientHeight = -1;

    /**
    * The width of the viewport
    * @type {Number}
     */
    this.clientWidth = -1;

    /**
    * A description of any error that occurred
    * @type {String}
     */
    this.error = '';

    /**
    * Whether the tab is focused or not (populated by ActionScript)
    * @type {Boolean}
     */
    this.focus = null;

    /**
    * The frame rate of the asset (populated by ActionScript)
    * @type {Number}
     */
    this.fps = -1;

    /**
    * A unique identifier of the asset
    * @type {String}
     */
    this.id = '';

    /**
    * Whether geometry checking is supported. Geometry support requires
    * that the asset is not within an iframe.
    * @type {Boolean}
     */
    this.geometrySupported = null;

    /**
    * The viewability state measured by the geometry technique. Only populated
    * when OVV.DEBUG is true.
    * @type {String}
    * @see {@link checkGeometry}
    * @see {@link OVV#DEBUG}
     */
    this.geometryViewabilityState = '';

    /**
    * The technique used to populate OVVCheck.viewabilityState. Will be either
    * OVV.GEOMETRY when OVV is run in the root page, or OVV.BEACON when OVV is
    * run in an iframe. When in debug mode, will always remain blank.
    * @type {String}
     */
    this.technique = '';

    /**
    * Whether this asset is in an iframe.
    * @type {Boolean}
     */
    this.inIframe = null;

    /**
    * The distance, in pixels, from the bottom of the asset to the bottom of
    * the viewport
    * @type {Number}
     */
    this.objBottom = -1;

    /**
    * The distance, in pixels, from the left of the asset to the left of
    * the viewport
    * @type {Number}
     */
    this.objLeft = -1;

    /**
    * The distance, in pixels, from the right of the asset to the right of
    * the viewport
    * @type {Number}
     */
    this.objRight = -1;

    /**
    * The distance, in pixels, from the top of the asset to the top of
    * the viewport
    * @type {Number}
     */
    this.objTop = -1;

    /**
    * The percentage of the player that is viewable within the viewport
    * @type {Number}
     */
    this.percentViewable = -1;

    /**
    * Set to {@link OVVCheck#VIEWABLE} when the player was at least 50%
    * viewable. Set to OVVCheck when the player was less than 50% viewable.
    * Set to {@link OVVCheck#UNMEASURABLE} when a determination could not be made.
    * @type {String}
    * @see {@link OVVCheck.UNMEASURABLE}
    * @see {@link OVVCheck.VIEWABLE}
    * @see {@link OVVCheck.UNVIEWABLE}
     */
    this.viewabilityState = '';
  };

  /**
  * The value that {@link OVVCheck#viewabilityState} will be set to if OVV cannot
  * determine whether the asset is at least 50% viewable.
   */
  OVVCheck.UNMEASURABLE = 'unmeasurable';

  /**
  * The value that {@link OVVCheck#viewabilityState} will be set to if OVV
  * determines that the asset is at least 50% viewable.
   */
  OVVCheck.VIEWABLE = 'viewable';

  /**
  * The value that {@link OVVCheck#viewabilityState} will be set to if OVV
  * determines that the asset is less than 50% viewable.
   */
  OVVCheck.UNVIEWABLE = 'unviewable';

  /**
  * The value that {@link OVVCheck#technique} will be set to if OVV
  * uses the geometry technique to determine {@link OVVCheck#viewabilityState}
   */
  OVVCheck.GEOMETRY = 'geometry';

  /**
  * Represents an Asset which OVV is going to determine the viewability of
  * @constructor
  * @param {String} uid - The unique identifier of this asset
   */
  OVVAsset = function(uid, dependencies, plr) {

    /**
    * The value of the square root of 2. Computed here and saved for reuse
    * later. Approximately 1.41.
    * @type {Number}
     */
    var SQRT_2, checkGeometry, findPlayer, geometryViewabilityCalculator, id, isInFocus, isOnScreen, lastPlayerLocation, player;
    SQRT_2 = Math.sqrt(2);

    /**
    * the id of the ad that this asset is associated with
    * @type {!String}
     */
    id = uid;

    /**
    * The last known location of the player on the page
    * @type {ClientRect}
     */
    lastPlayerLocation = void 0;

    /**
    * The video player being measured
    * @type {Element}
     */
    player = plr;
    geometryViewabilityCalculator = new OVVGeometryViewabilityCalculator;

    /**
    * <p>
    * Returns an {@link OVVCheck} object populated with information gathered
    * from the browser. The viewabilityState attribute is populated with
    * either {@link OVVCheck.VIEWABLE}, {@link OVVCheck.UNVIEWABLE}, or {@link OVVCheck.UNMEASURABLE}
    * as determined by either beacon technique when in a cross domain iframe, or the
    * geometry technique otherwise.
    * </p><p>
    * The geometry technique compares the bounds of the viewport, taking
    * scrolling into account, and the bounds of the player.
    * </p>
    * @returns {OVVCheck}
    * @see {@link OVVCheck}
    * @see {@link checkGeometry}
     */
    this.checkViewability = function(windowContext) {
      var check, geometryViewable;
      check = new OVVCheck;
      check.id = id;
      check.inIframe = false;
      check.geometrySupported = true;
      check.focus = isInFocus();
      if (!player) {
        check.error = 'Player not found!';
        return check;
      }
      if ((VIROOL.OpenVV.browser.ID === VIROOL.OpenVV.browserIDEnum.MSIE || VIROOL.OpenVV.browser.ID === VIROOL.OpenVV.browserIDEnum.Firefox) && check.geometrySupported === false) {
        check.viewabilityState = OVVCheck.UNMEASURABLE;
        if (!VIROOL.OpenVV.DEBUG) {
          return check;
        }
      }
      if (check.geometrySupported) {
        check.technique = OVVCheck.GEOMETRY;
        checkGeometry(check, player, windowContext);
        check.viewabilityState = check.percentViewable >= 50 ? OVVCheck.VIEWABLE : OVVCheck.UNVIEWABLE;
        if (VIROOL.OpenVV.DEBUG) {
          check.geometryViewabilityState = check.viewabilityState;
        } else {
          return check;
        }
      } else {
        check.viewabilityState = OVVCheck.UNMEASURABLE;
      }
      if (VIROOL.OpenVV.DEBUG) {
        check.technique = '';
        if (check.geometryViewabilityState === null && check.beaconViewabilityState === null) {
          check.viewabilityState = OVVCheck.UNMEASURABLE;
        } else {
          geometryViewable = check.geometryViewabilityState === OVVCheck.VIEWABLE;
          check.viewabilityState = geometryViewable ? OVVCheck.VIEWABLE : OVVCheck.UNVIEWABLE;
        }
      }
      return check;
    };

    /**
    * Frees up resources created and used by the asset.
     */
    this.dispose = function() {
      var index;
      index = 1;
      clearInterval(VIROOL.OpenVV.positionInterval);
      VIROOL.OpenVV.removeAsset(this);
    };

    /**
    * @returns {String} The randomly generated ID of this asset
     */
    this.getId = function() {
      return id;
    };

    /**
    * @returns {Object} The associated asset's player
     */
    this.getPlayer = function() {
      return player;
    };

    /**
    * Performs the geometry technique to determine viewability. First gathers
    * information on the viewport and on the player. The compares the two to
    * determine what percentage, if any, of the player is within the bounds
    * of the viewport.
    * @param {OVVCheck} check The OVVCheck object to populate
    * @param {Element} player The HTML Element to measure
     */
    checkGeometry = function(check, player, contextWindow) {
      var viewabilityResult;
      viewabilityResult = geometryViewabilityCalculator.getViewabilityState(player, contextWindow);
      if (!viewabilityResult.error) {
        check.clientWidth = viewabilityResult.clientWidth;
        check.clientHeight = viewabilityResult.clientHeight;
        check.percentViewable = viewabilityResult.percentViewable;
        check.objTop = viewabilityResult.objTop;
        check.objBottom = viewabilityResult.objBottom;
        check.objLeft = viewabilityResult.objLeft;
        check.objRight = viewabilityResult.objRight;
      }
      return viewabilityResult;
    };

    /**
    * Determines whether a DOM element is within the bounds of the viewport
    * @param {Element} element An HTML Element
    * @returns {Boolean} Whether the parameter is at least partially within
    * the browser's viewport
     */
    isOnScreen = function(element) {
      var objRect, screenHeight, screenWidth;
      if (!element) {
        return false;
      }
      screenWidth = Math.max(document.body.clientWidth, window.innerWidth);
      screenHeight = Math.max(document.body.clientHeight, window.innerHeight);
      objRect = element.getClientRects()[0];
      return objRect.top < screenHeight && objRect.bottom > 0 && objRect.left < screenWidth && objRect.right > 0;
    };

    /**
    * Finds the video player associated with this asset by searching through
    * each EMBED and OBJECT element on the page, testing to see if it has the
    * randomly generated callback signature.
    * @returns {Element|null} The video player being measured
     */
    findPlayer = function() {
      return document.getElementById('widgetPlayer');
    };
    isInFocus = function() {
      var inFocus;
      inFocus = true;
      if (typeof document.hidden !== 'undefined') {
        inFocus = window.document.hidden ? false : true;
      } else if (document.hasFocus) {
        inFocus = document.hasFocus();
      }
      if (VIROOL.OpenVV.IN_IFRAME === false && inFocus === true && document.hasFocus) {
        inFocus = document.hasFocus();
      }
      return inFocus;
    };
    if (player && player.startImpressionTimer) {
      player.startImpressionTimer();
    }
  };
  OVVGeometryViewabilityCalculator = function() {
    var getAssetViewablePercentage, getAssetVisibleDimension, getPositionRelativeToViewPort, getViewPortSize;
    this.getViewabilityState = function(element, contextWindow) {
      var assetRect, assetSize, viewPortSize, viewablePercentage;
      viewPortSize = getViewPortSize();
      if (viewPortSize.height === Infinity || viewPortSize.width === Infinity) {
        return {
          error: 'Failed to determine viewport'
        };
      }
      assetSize = getAssetVisibleDimension(element, contextWindow);
      viewablePercentage = getAssetViewablePercentage(assetSize, viewPortSize);
      assetRect = element.getBoundingClientRect();
      return {
        clientWidth: viewPortSize.width,
        clientHeight: viewPortSize.height,
        objTop: assetRect.top,
        objBottom: assetRect.bottom,
        objLeft: assetRect.left,
        objRight: assetRect.right,
        percentViewable: viewablePercentage
      };
    };

    /**
    * Get the viewport size by taking the smallest dimensions
     */
    getViewPortSize = function() {
      var contextWindow, viewPortSize;
      viewPortSize = {
        width: Infinity,
        height: Infinity
      };
      contextWindow = window.top;
      if (!isNaN(contextWindow.document.body.clientWidth) && contextWindow.document.body.clientWidth > 0) {
        viewPortSize.width = contextWindow.document.body.clientWidth;
      }
      if (!isNaN(contextWindow.document.body.clientHeight) && contextWindow.document.body.clientHeight > 0) {
        viewPortSize.height = contextWindow.document.body.clientHeight;
      }
      if (!!contextWindow.document.documentElement && !!contextWindow.document.documentElement.clientWidth && !isNaN(contextWindow.document.documentElement.clientWidth)) {
        viewPortSize.width = contextWindow.document.documentElement.clientWidth;
      }
      if (!!contextWindow.document.documentElement && !!contextWindow.document.documentElement.clientHeight && !isNaN(contextWindow.document.documentElement.clientHeight)) {
        viewPortSize.height = contextWindow.document.documentElement.clientHeight;
      }
      if (!!contextWindow.innerWidth && !isNaN(contextWindow.innerWidth)) {
        viewPortSize.width = contextWindow.innerWidth;
      }
      if (!!contextWindow.innerHeight && !isNaN(contextWindow.innerHeight)) {
        viewPortSize.height = contextWindow.innerHeight;
      }
      return viewPortSize;
    };

    /**
    * Recursive function that return the asset (element) visible dimension
    * @param {element} The element to get his visible dimension
    * @param {contextWindow} The relative window
     */
    getAssetVisibleDimension = function(element, contextWindow) {
      var currWindow, elementRect, parentDimension, parentWindow, resultDimension;
      currWindow = contextWindow;
      parentWindow = contextWindow.parent;
      resultDimension = {
        width: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      };
      if (element) {
        elementRect = getPositionRelativeToViewPort(element, contextWindow);
        elementRect.width = elementRect.right - elementRect.left;
        elementRect.height = elementRect.bottom - elementRect.top;
        resultDimension = elementRect;
        if (currWindow !== parentWindow) {
          parentDimension = getAssetVisibleDimension(currWindow.frameElement, parentWindow);
          if (parentDimension.bottom < resultDimension.bottom) {
            if (parentDimension.bottom < resultDimension.top) {
              resultDimension.top = parentDimension.bottom;
            }
            resultDimension.bottom = parentDimension.bottom;
          }
          if (parentDimension.right < resultDimension.right) {
            if (parentDimension.right < resultDimension.left) {
              resultDimension.left = parentDimension.right;
            }
            resultDimension.right = parentDimension.right;
          }
          resultDimension.width = resultDimension.right - resultDimension.left;
          resultDimension.height = resultDimension.bottom - resultDimension.top;
        }
      }
      return resultDimension;
    };
    getPositionRelativeToViewPort = function(element, contextWindow) {
      var currWindow, elementRect, parentWindow, resultPosition;
      currWindow = contextWindow;
      parentWindow = contextWindow.parent;
      resultPosition = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      };
      if (element) {
        elementRect = element.getBoundingClientRect();
        if (currWindow !== parentWindow) {
          resultPosition = getPositionRelativeToViewPort(currWindow.frameElement, parentWindow);
        }
        resultPosition = {
          left: elementRect.left + resultPosition.left,
          right: elementRect.right + resultPosition.left,
          top: elementRect.top + resultPosition.top,
          bottom: elementRect.bottom + resultPosition.top
        };
      }
      return resultPosition;
    };

    /**
    * Calculate asset viewable percentage given the asset size and the viewport
    * @param {effectiveAssetRect} the asset viewable rect; effectiveAssetRect = {left :, top :,bottom:,right:,}
    * @param {viewPortSize} the browser viewport size;
     */
    getAssetViewablePercentage = function(effectiveAssetRect, viewPortSize) {
      var asset, assetVisiableHeight, assetVisiableWidth;
      assetVisiableHeight = 0;
      assetVisiableWidth = 0;
      asset = {
        width: effectiveAssetRect.right - effectiveAssetRect.left,
        height: effectiveAssetRect.bottom - effectiveAssetRect.top
      };
      if (effectiveAssetRect.bottom < 0 || effectiveAssetRect.right < 0 || effectiveAssetRect.top > viewPortSize.height || effectiveAssetRect.left > viewPortSize.width || asset.width <= 0 || asset.height <= 0) {
        return 0;
      }
      if (effectiveAssetRect.top < 0) {
        assetVisiableHeight = asset.height + effectiveAssetRect.top;
        if (assetVisiableHeight > viewPortSize.height) {
          assetVisiableHeight = viewPortSize.height;
        }
      } else if (effectiveAssetRect.top + asset.height > viewPortSize.height) {
        assetVisiableHeight = viewPortSize.height - effectiveAssetRect.top;
      } else {
        assetVisiableHeight = asset.height;
      }
      if (effectiveAssetRect.left < 0) {
        assetVisiableWidth = asset.width + effectiveAssetRect.left;
        if (assetVisiableWidth > viewPortSize.width) {
          assetVisiableWidth = viewPortSize.width;
        }
      } else if (effectiveAssetRect.left + asset.width > viewPortSize.width) {
        assetVisiableWidth = viewPortSize.width - effectiveAssetRect.left;
      } else {
        assetVisiableWidth = asset.width;
      }
      return Math.round(((assetVisiableWidth * assetVisiableHeight) / (asset.width * asset.height)) * 100);
    };
  };
  VIROOL.OpenVV = VIROOL.OpenVV || new OVV;
  VIROOL.OpenVVAsset = VIROOL.OpenVVAsset || OVVAsset;
  return module.exports = {
    OpenVV: new OVV,
    OVVAsset: OVVAsset
  };
})();



},{}],9:[function(require,module,exports){
var CurrentScript, log;

log = require('./log');

CurrentScript = (function(document) {
  var currentScript, findByPath, markAsTaken, matchPath;
  currentScript = function() {
    var scripts;
    if (document.currentScript) {
      return document.currentScript;
    } else if (document.readyState === 'loading') {
      scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    }
  };
  matchPath = function(script, path) {
    var pathRegexp, src;
    if (!(path && path.length > 0)) {
      return false;
    }
    src = script.getAttribute('src');
    pathRegexp = new RegExp(path);
    return typeof src === 'string' && pathRegexp.test(src);
  };
  findByPath = function(path) {
    var availableScripts, matchingScripts, s, scripts;
    scripts = document.getElementsByTagName('script');
    availableScripts = (function() {
      var i, len, results;
      results = [];
      for (i = 0, len = scripts.length; i < len; i++) {
        s = scripts[i];
        if (s.hasAttribute('src') && !s.hasAttribute('data-vrl-taken')) {
          results.push(s);
        }
      }
      return results;
    })();
    matchingScripts = (function() {
      var i, len, results;
      results = [];
      for (i = 0, len = availableScripts.length; i < len; i++) {
        s = availableScripts[i];
        if (matchPath(s, path)) {
          results.push(s);
        }
      }
      return results;
    })();
    return matchingScripts[0];
  };
  markAsTaken = function(element) {
    return element.setAttribute('data-vrl-taken', 'true');
  };
  return {
    find: function(path) {
      var e, error, scriptEl;
      try {
        scriptEl = currentScript() || findByPath(path);
        if (scriptEl) {
          markAsTaken(scriptEl);
          return scriptEl;
        }
      } catch (error) {
        e = error;
        log("[CurrentScript] failed to find script tag: " + e.message);
      }
    }
  };
})(window.document);

module.exports = CurrentScript;



},{"./log":12}],10:[function(require,module,exports){
module.exports = function(el, windowContext) {
  var rect;
  if (!el) {
    return false;
  }
  rect = el.getBoundingClientRect();
  return rect.top >= 0 && rect.left >= 0 && rect.bottom <= ((windowContext.innerHeight || document.documentElement.clientHeight) - 30) && rect.right <= (windowContext.innerWidth || document.documentElement.clientWidth);
};



},{}],11:[function(require,module,exports){
//
"use strict";

var uniqId = (function () {
  var id = 0;
  return function () {
    return id++;
  };
})();

function extend() {
  var args = Array.prototype.slice.call(arguments);
  var orig = args.shift();
  if (args.length === 0) {
    return orig;
  }
  for (var i = 0; i <= args.length; i++) {
    var r = args[i];
    for (var key in r) {
      if (Object.prototype.hasOwnProperty.call(r, key)) {
        orig[key] = r[key];
      }
    }
  }
  return orig;
}

function pick(obj, list, context) {
  var result = {};

  if (typeof list === 'string') {
    list = [list];
  }

  Object.keys(obj).forEach(function (key) {
    if (list.indexOf(key) > -1) {
      result[key] = obj[key];
    }
  }, context);

  return result;
}

function once(fn) {
  var f = function f() {
    if (f.called) return f.value;
    f.called = true;
    return f.value = fn.apply(this, arguments);
  };
  f.called = false;
  return f;
}

function randHex(len) {
  var charset, str, _i;
  str = "";
  if (len > 0) {
    charset = "abcdef0123456789";
    for (_i = 1; 1 <= len ? _i <= len : _i >= len; 1 <= len ? _i++ : _i--) {
      str += charset.charAt(Math.floor(Math.random() * charset.length));
    }
  }
  return str;
};

module.exports = {
  once: once,
  pick: pick,
  extend: extend,
  uniqueId: uniqId,
  randHex: randHex
};

},{}],12:[function(require,module,exports){
'use strict';

var isFriendlyIframe = (function () {
  try {
    return window.top !== window.self && window.top.document != null;
  } catch (_error) {
    return false;
  }
})();
var unitContext = isFriendlyIframe ? window.top : window.self;
var debug = unitContext.location.href.indexOf('VRL_DEBUG') > -1;

var log = function log() {
  if (window.console && debug) {
    var args = Array.prototype.slice.call(arguments, 0);
    Function.prototype.apply.call(console.log, console, args);
  }
};

log.enabled = debug;

module.exports = log;

},{}],13:[function(require,module,exports){
var CHECKER_WIDGET_ANCHOR_ADDED, URLTools, VIROOL, log, uuid;

VIROOL = require('./virool_namespace');

URLTools = require('./url_tools');

log = require('./log');

uuid = require('./uuid');

CHECKER_WIDGET_ANCHOR_ADDED = false;

if (VIROOL.OpportinityChecker == null) {
  VIROOL.OpportinityChecker = (function() {
    var INNER_RUBICON_SITE_KEY, TRACK_PIXELS, advancedCheckEnabled, checkerInstance, isFriendlyIframe, unitContext;

    TRACK_PIXELS = {
      production_opportunity: 'https://ups.virool.com/ad_opportunity',
      production_page_load: 'https://ups.virool.com/page_load'
    };

    INNER_RUBICON_SITE_KEY = '6454c68';

    checkerInstance = null;

    advancedCheckEnabled = false;

    isFriendlyIframe = (function() {
      var error;
      try {
        return window.top !== window.self && (window.top.document != null);
      } catch (error) {
        return false;
      }
    })();

    unitContext = isFriendlyIframe ? window.top : window.self;

    OpportinityChecker.create = function(config) {
      if (checkerInstance != null) {
        return;
      }
      checkerInstance = new this(config, unitContext);
      return this.instance = checkerInstance;
    };

    OpportinityChecker.enableAdvancedCheck = function() {
      return advancedCheckEnabled = true;
    };

    OpportinityChecker.prototype.pixelId = 'virool-opportunity-pixel';

    OpportinityChecker.prototype.sentPixels = {};

    OpportinityChecker.prototype.startTimestamp = +(new Date());

    OpportinityChecker.prototype.sessionUuid = uuid();

    function OpportinityChecker(config1, context) {
      this.config = config1;
      this.context = context;
      this.widgetUrl = this.config.widgetUrl;
      this.contextDoc = this.context.document;
      if (((this.widgetUrl != null) && this.widgetUrl.length > 0) || this.config.widgetParams) {
        this.widgetParams = this.config.widgetParams || URLTools.extractParams(this.widgetUrl);
        this.widgetAnchor = this.widgetParams.widget_anchor;
        this.pageDomain = this.parseDomain();
        this.siteKey = this.parseSiteKey();
        if (advancedCheckEnabled && this.config.scriptTag) {
          this.findPlacement();
        }
      }
    }

    OpportinityChecker.prototype.findPlacement = function() {
      var settings;
      if (VIROOL.PlacementManager) {
        settings = window.viroolWidgetSettings || {};
        VIROOL.PlacementManager.findPlacement(this.context, this.config.scriptTag, this.widgetParams, settings, (function(_this) {
          return function(element, position) {
            return log("found placement: ", element);
          };
        })(this));
      }
    };

    OpportinityChecker.prototype.parseDomain = function() {
      if (this.widgetParams.or != null) {
        return URLTools.extractDomain(this.widgetParams.or);
      } else {
        return this.context.location.hostname;
      }
    };

    OpportinityChecker.prototype.parseSiteKey = function() {
      var error;
      if ((this.widgetUrl != null) && this.widgetUrl.length > 0) {
        try {
          return this.widgetUrl.split('/widgets/')[1].substring(0, 7);
        } catch (error) {

        }
      } else {
        return this.widgetParams.siteKey;
      }
    };

    OpportinityChecker.prototype.hasValidConfig = function() {
      return !this.context.VRL_OPPORTUNITY_CHECKER_STARTED;
    };

    OpportinityChecker.prototype.isVisible = function() {
      var el, rect;
      el = this.contextDoc.getElementById(this.pixelId);
      if (el == null) {
        return false;
      }
      rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.left >= 0 && rect.bottom <= ((this.context.innerHeight || this.contextDoc.documentElement.clientHeight) - 50) && rect.right <= (this.context.innerWidth || this.contextDoc.documentElement.clientWidth);
    };

    OpportinityChecker.prototype.addControlAnchor = function(elem, method) {
      var div;
      if (this.anchorAdded || CHECKER_WIDGET_ANCHOR_ADDED) {
        return;
      }
      div = this.contextDoc.createElement('div');
      div.id = this.pixelId;
      div.style.width = '1px';
      div.style.height = '1px';
      div.style.background = 'transparent';
      div.style.margin = '0';
      div.style.padding = '0';
      elem[method](div);
      CHECKER_WIDGET_ANCHOR_ADDED = true;
      return this.anchorAdded = true;
    };

    OpportinityChecker.prototype.removeControlAnchor = function() {
      var anchor;
      anchor = this.contextDoc.getElementById(this.pixelId);
      if (anchor != null) {
        return anchor.parentElement.removeChild(anchor);
      }
    };

    OpportinityChecker.prototype.isRubiconSite = function() {
      return this.siteKey === '903acc3';
    };

    OpportinityChecker.prototype.trackProdPixelUrl = function(kind, skey) {
      return TRACK_PIXELS[kind] + "?oppo_checker_uuid=" + this.sessionUuid + "&skey=" + skey + "&domain=" + this.pageDomain + "&d=" + (Math.floor((Math.random() * 999999) + 1));
    };

    OpportinityChecker.prototype.sendPixel = function(kind, url) {
      if (!this.sentPixels.hasOwnProperty(kind)) {
        log(url);
        (new Image()).src = url;
        this.sentPixels[kind] = true;
      }
    };

    OpportinityChecker.prototype.sendInitPixel = function() {
      this.sendPixel('pageLoadProd', this.trackProdPixelUrl('production_page_load', this.siteKey));
      if (this.isRubiconSite()) {
        this.sendPixel('pageLoadProdInner', this.trackProdPixelUrl('production_page_load', INNER_RUBICON_SITE_KEY));
      }
      if (typeof this.config.onInit === 'function') {
        this.config.onInit.call(this);
      }
    };

    OpportinityChecker.prototype.sendInViewPixel = function() {
      this.sendPixel('inViewProd', this.trackProdPixelUrl('production_opportunity', this.siteKey));
      if (this.isRubiconSite()) {
        this.sendPixel('inViewProdInner', this.trackProdPixelUrl('production_opportunity', INNER_RUBICON_SITE_KEY));
      }
      if (typeof this.config.onInView === 'function') {
        this.config.onInView.call(this);
      }
    };

    OpportinityChecker.prototype.startChecking = function() {
      var elem, method, ref;
      if (this.hasValidConfig()) {
        this.sendInitPixel();
        if (window.VIROOL.OpportinityCheckerParams) {
          ref = window.VIROOL.OpportinityCheckerParams, elem = ref[0], method = ref[1];
          this.addControlAnchor(elem, method);
        }
        this.checkingInterval = window.setInterval((function(_this) {
          return function() {
            if (_this.isVisible()) {
              _this.sendInViewPixel();
              window.clearInterval(_this.checkingInterval);
              if (!_this.heartbeatEnabled) {
                return _this.removeControlAnchor();
              }
            }
          };
        })(this), 500);
        return this.context.VRL_OPPORTUNITY_CHECKER_STARTED = true;
      }
    };

    return OpportinityChecker;

  })();
}

module.exports = VIROOL.OpportinityChecker;



},{"./log":12,"./url_tools":18,"./uuid":19,"./virool_namespace":20}],14:[function(require,module,exports){
var $, VIROOL, log, smart,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

VIROOL = require('./virool_namespace');

$ = require('./../vendor/jquery');

smart = require('./smart');

log = require('./log');

VIROOL.PlacementManager = VIROOL.PlacementManager || (function() {
  var BasePlacement, DynamicPlacement, NegativeAnchor, PlacementFactory, PlacementManager, SelectorPlacement, SelfAnchorPlacement, SelfIframeAnchorPlacement, SmartPlacement, randHex;
  randHex = function(len) {
    var charset, i, ref, str;
    str = "";
    if (len > 0) {
      charset = "abcdef0123456789";
      for (i = 1, ref = len; 1 <= ref ? i <= ref : i >= ref; 1 <= ref ? i++ : i--) {
        str += charset.charAt(Math.floor(Math.random() * charset.length));
      }
    }
    return str;
  };
  NegativeAnchor = (function() {
    function NegativeAnchor(context1, params1) {
      this.context = context1;
      this.params = params1;
      this._deferred = $.Deferred();
      if (this.selector()) {
        $((function(_this) {
          return function() {
            if ($(_this.selector(), _this.context.document).length) {
              return _this._deferred.resolve();
            } else {
              return _this._deferred.reject();
            }
          };
        })(this));
      } else {
        this._deferred.reject();
      }
    }

    NegativeAnchor.prototype.selector = function() {
      return this.params.negative_anchor || this.params.prevent_loading_selector || void 0;
    };

    NegativeAnchor.prototype.exists = function() {
      return this._deferred.promise();
    };

    return NegativeAnchor;

  })();
  BasePlacement = (function() {
    var VALID_POSITIONS;

    VALID_POSITIONS = ['after', 'before', 'prepend', 'append'];

    BasePlacement.prototype.id = "p" + (randHex(10));

    function BasePlacement(context1, embedScript1, params1, pageSettings1) {
      this.context = context1;
      this.embedScript = embedScript1;
      this.params = params1;
      this.pageSettings = pageSettings1;
      this.contextDoc = this.context.document;
      this.negativeAnchor = new NegativeAnchor(this.context, this.params);
      this._deferred = $.Deferred();
      this._anchorElement = null;
    }

    BasePlacement.prototype.getAnchorElement = function() {
      return this._deferred.reject("not_implemented");
    };

    BasePlacement.prototype.findAnchor = function() {
      $.when(this.negativeAnchor.exists()).then(((function(_this) {
        return function() {
          return _this._deferred.reject("negative_anchor_exists");
        };
      })(this)), ((function(_this) {
        return function() {
          return _this.getAnchorElement();
        };
      })(this)));
      return this._deferred.promise();
    };

    BasePlacement.prototype.renderAnchor = function() {
      return this._anchorElement;
    };

    BasePlacement.prototype.renderPosition = function() {
      var ref;
      if (ref = this.params.widget_position, indexOf.call(VALID_POSITIONS, ref) >= 0) {
        return this.params.widget_position;
      } else {
        return 'after';
      }
    };

    return BasePlacement;

  })();
  SelfAnchorPlacement = (function(superClass) {
    extend(SelfAnchorPlacement, superClass);

    function SelfAnchorPlacement() {
      return SelfAnchorPlacement.__super__.constructor.apply(this, arguments);
    }

    SelfAnchorPlacement.prototype.anchorElement = function() {
      return this._anchorElement || this.embedScript;
    };

    SelfAnchorPlacement.prototype.getAnchorElement = function() {
      if (this._anchorElement = this.anchorElement()) {
        return this._deferred.resolve(this.anchorElement(), this.renderPosition());
      } else {
        return this._deferred.reject("anchor_not_found");
      }
    };

    SelfAnchorPlacement.prototype.renderPosition = function() {
      return 'after';
    };

    return SelfAnchorPlacement;

  })(BasePlacement);
  SelfIframeAnchorPlacement = (function(superClass) {
    extend(SelfIframeAnchorPlacement, superClass);

    function SelfIframeAnchorPlacement() {
      return SelfIframeAnchorPlacement.__super__.constructor.apply(this, arguments);
    }

    SelfIframeAnchorPlacement.prototype.anchorElement = function() {
      return window.self.frameElement;
    };

    SelfIframeAnchorPlacement.prototype.renderPosition = function() {
      return 'before';
    };

    return SelfIframeAnchorPlacement;

  })(SelfAnchorPlacement);
  SelectorPlacement = (function(superClass) {
    extend(SelectorPlacement, superClass);

    function SelectorPlacement() {
      return SelectorPlacement.__super__.constructor.apply(this, arguments);
    }

    SelectorPlacement.prototype.getAnchorElement = function() {
      if (this._anchorElement = $(this.params.widget_anchor, this.contextDoc)[0]) {
        return this._deferred.resolve(this._anchorElement, this.renderPosition());
      } else {
        return $((function(_this) {
          return function() {
            if (_this._anchorElement = $(_this.params.widget_anchor, _this.contextDoc)[0]) {
              return _this._deferred.resolve(_this._anchorElement, _this.renderPosition());
            } else {
              return _this._deferred.reject("anchor_not_found");
            }
          };
        })(this));
      }
    };

    return SelectorPlacement;

  })(BasePlacement);
  SmartPlacement = (function(superClass) {
    extend(SmartPlacement, superClass);

    function SmartPlacement() {
      return SmartPlacement.__super__.constructor.apply(this, arguments);
    }

    SmartPlacement.prototype.getAnchorElement = function() {
      return $((function(_this) {
        return function() {
          var anchor_wrapper, content, position, ref, selector, smart_count_node, trash, wordCount;
          content = smart(_this.contextDoc);
          anchor_wrapper = $("<div id='anchor_wrapper_" + _this.id + "'></div>");
          ref = _this.params.widget_anchor.split('/'), trash = ref[0], position = ref[1], selector = ref[2];
          if (position === 'global') {
            content.main = $(selector, _this.contextDoc);
          }
          if (content.main.length === 0) {
            _this._deferred.reject("smart_node_not_found");
            return;
          }
          if (_this.params.smart_highlight) {
            content.main.css('border', '3px solid red');
            content.middle.css('border', '3px dashed red');
          }
          if (_this.params.smart_word_count) {
            if (_this.params.smart_count_node) {
              smart_count_node = $(_this.params.smart_count_node, _this.contextDoc);
            } else {
              smart_count_node = content.main;
            }
            wordCount = smart_count_node.text().split(/\s+/).length;
            if (wordCount < parseInt(_this.params.smart_word_count)) {
              _this._deferred.reject("not_enough_words_found");
              return;
            }
          }
          switch (position) {
            case 'global':
              $(selector, _this.contextDoc).prepend(anchor_wrapper);
              break;
            case 'after':
              content.main.find(selector).after(anchor_wrapper);
              break;
            case 'before':
              content.main.find(selector).before(anchor_wrapper);
              break;
            case 'top':
              content.main.prepend(anchor_wrapper);
              break;
            case 'bottom':
              content.main.append(anchor_wrapper);
              break;
            case 'middle':
            case void 0:
              content.middle.after(anchor_wrapper);
              break;
            default:
              content.middle.after(anchor_wrapper);
          }
          _this._anchorElement = anchor_wrapper[0];
          _this._deferred.resolve(_this._anchorElement, _this.renderPosition());
        };
      })(this));
    };

    return SmartPlacement;

  })(BasePlacement);
  DynamicPlacement = (function(superClass) {
    extend(DynamicPlacement, superClass);

    function DynamicPlacement() {
      return DynamicPlacement.__super__.constructor.apply(this, arguments);
    }

    DynamicPlacement.prototype.fakeUnit = function() {
      return {
        $: $,
        _: VIROOL._ || {},
        log: console.log,
        context: this.context,
        contextDoc: this.contextDoc
      };
    };

    DynamicPlacement.prototype.callAnchorFn = function() {
      var fnResponse;
      fnResponse = this.pageSettings.widget_anchor.call(this.fakeUnit());
      if ($.isArray(fnResponse)) {
        fnResponse = fnResponse[0];
      }
      return fnResponse;
    };

    DynamicPlacement.prototype.getAnchorElement = function() {
      if (this._anchorElement = this.callAnchorFn()) {
        return this._deferred.resolve(this._anchorElement, this.renderPosition());
      } else {
        return $((function(_this) {
          return function() {
            if (_this._anchorElement = _this.callAnchorFn()) {
              return _this._deferred.resolve(_this._anchorElement, _this.renderPosition());
            } else {
              return _this._deferred.reject("anchor_not_found");
            }
          };
        })(this));
      }
    };

    return DynamicPlacement;

  })(BasePlacement);
  PlacementFactory = (function() {
    function PlacementFactory() {}

    PlacementFactory.prototype.create = function(context, embedScript, params, pageSettings) {
      if ($.isFunction(pageSettings.widget_anchor)) {
        return new DynamicPlacement(context, embedScript, params, pageSettings);
      } else if (params.widget_anchor && params.widget_anchor.match(/^SMART/)) {
        return new SmartPlacement(context, embedScript, params, pageSettings);
      } else if (params.widget_anchor) {
        return new SelectorPlacement(context, embedScript, params, pageSettings);
      } else if (context !== window.self) {
        return new SelfIframeAnchorPlacement(context, embedScript, params, pageSettings);
      } else {
        return new SelfAnchorPlacement(context, embedScript, params, pageSettings);
      }
    };

    return PlacementFactory;

  })();
  PlacementManager = (function() {
    var sendAnchorToOpportunityChecker;

    function PlacementManager() {}

    sendAnchorToOpportunityChecker = function(elem, position) {
      var ref;
      if ((ref = window.VIROOL.OpportinityChecker) != null ? ref.instance : void 0) {
        return window.VIROOL.OpportinityChecker.instance.addControlAnchor($(elem), position);
      } else {
        return window.VIROOL.OpportinityCheckerParams = [$(elem), position];
      }
    };

    PlacementManager.placements = [];

    PlacementManager.factory = new PlacementFactory;

    PlacementManager.findPlacement = function(context, embedScript, params, pageSettings, onResolved) {
      var newPlacement;
      newPlacement = this.factory.create(context, embedScript, params, pageSettings);
      this.placements.push(newPlacement);
      $.when(newPlacement.findAnchor()).then((function(element, position) {
        if ($.isFunction(onResolved)) {
          onResolved.call(newPlacement, element, position);
        }
        return sendAnchorToOpportunityChecker(element, position);
      }), ((function(_this) {
        return function(msg) {
          return console.log("failed to get anchor element: " + msg);
        };
      })(this)));
      return newPlacement;
    };

    return PlacementManager;

  })();
  return PlacementManager;
})();

module.exports = VIROOL.PlacementManager;



},{"./../vendor/jquery":21,"./log":12,"./smart":16,"./virool_namespace":20}],15:[function(require,module,exports){
var PostMessageManager;

PostMessageManager = (function() {
  var stringify;

  stringify = function(message) {
    if (typeof message !== 'string') {
      return JSON.stringify(message);
    } else {
      return message;
    }
  };

  function PostMessageManager(windowContext) {
    this.windowContext = windowContext;
    this.subscribers = this.jsonSubscribers = [];
    this._subscribeToPostMessages();
  }

  PostMessageManager.prototype._subscribeToPostMessages = function() {
    var eventMethod, eventer, messageEvent;
    eventMethod = (this.windowContext.addEventListener ? "addEventListener" : "attachEvent");
    eventer = this.windowContext[eventMethod];
    messageEvent = (eventMethod === "attachEvent" ? "onmessage" : "message");
    eventer.call(this.windowContext, messageEvent, this._buildMessageHandler(this), false);
  };

  PostMessageManager.prototype._buildMessageHandler = function(self) {
    return function(event) {
      return self._messageHandler(event);
    };
  };

  PostMessageManager.prototype._messageHandler = function(event) {
    var i, len, ref, subscriber;
    ref = this.subscribers;
    for (i = 0, len = ref.length; i < len; i++) {
      subscriber = ref[i];
      subscriber.call(this, event);
    }
    if (this.jsonSubscribers.length) {
      this._jsonMessageHandler(event);
    }
  };

  PostMessageManager.prototype._jsonMessageHandler = function(event) {
    var e, error, i, len, parsedMessage, ref, results, subscriber;
    try {
      parsedMessage = JSON.parse(event.data);
      ref = this.jsonSubscribers;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        subscriber = ref[i];
        results.push(subscriber.call(this, parsedMessage, event));
      }
      return results;
    } catch (error) {
      e = error;
    }
  };

  PostMessageManager.prototype.addListener = function(func) {
    if (typeof func === 'function') {
      return this.subscribers.push(func);
    }
  };

  PostMessageManager.prototype.addJsonListener = function(func) {
    if (typeof func === 'function') {
      return this.jsonSubscribers.push(func);
    }
  };

  PostMessageManager.prototype.on = function(_, func) {
    return this.addJsonListener(func);
  };

  PostMessageManager.prototype.sendTo = function(windowObj, message, origin) {
    if (origin == null) {
      origin = '*';
    }
    return windowObj.postMessage(message, origin);
  };

  PostMessageManager.prototype.sendToParent = function(message, origin) {
    if (origin == null) {
      origin = '*';
    }
    return this.sendTo(window.parent, stringify(message), origin);
  };

  PostMessageManager.prototype.sendToFrame = function(iframe, message, origin) {
    if (origin == null) {
      origin = '*';
    }
    return this.sendTo(iframe.contentWindow, stringify(message), origin);
  };

  return PostMessageManager;

})();

module.exports = PostMessageManager;



},{}],16:[function(require,module,exports){
'use strict';

var $ = require('./../vendor/jquery');
var helpers = require("./smart_helpers");

var is_friendly_iframe = (function () {
  try {
    return window.top !== window.self && window.top.document != null;
  } catch (_error) {
    return false;
  }
})();

var doc_node = is_friendly_iframe ? window.top.document : document;

var getMainNode = function getMainNode(contextDoc) {
  $('*', contextDoc).each(function (index) {
    $(this).attr('viroolsmart', index);
  });

  var readNode = helpers.grabArticle(contextDoc.cloneNode(true));
  var selector = "";

  if (readNode.childNodes.length < 1) {
    return $(contextDoc.body);
  }

  var node = $(readNode.childNodes[0]);
  var result = $("[viroolsmart=" + node.attr('viroolsmart') + "]", contextDoc);;
  $('*', contextDoc).each(function (index) {
    $(this).removeAttr('viroolsmart', index);
  });
  return result.length > 0 ? result : $('body', contextDoc);
};

var getMiddleElem = function getMiddleElem(main) {
  return $(main.children()[parseInt(main.children().length / 2)]);
};

module.exports = function (contextDoc) {
  if (!contextDoc) {
    contextDoc = doc_node;
  }
  var main = getMainNode(contextDoc);
  var middle = getMiddleElem(main);
  return { main: main, middle: middle, context: contextDoc };
};

},{"./../vendor/jquery":21,"./smart_helpers":17}],17:[function(require,module,exports){
'use strict';

var log = require('./log');

//var url = require("url");
var url = {};
var dbg = function dbg(text) {
  console.log("LOG: ", text);
};

// All of the regular expressions in use within readability.
var regexps = {
  unlikelyCandidatesRe: /combx|modal|lightbox|comment|disqus|foot|header|menu|meta|nav|rss|shoutbox|sidebar|sponsor|social|teaserlist|time|tweet|twitter/i,
  okMaybeItsACandidateRe: /and|article|body|column|main/i,
  positiveRe: /article|body|content|entry|hentry|page|pagination|post|text/i,
  negativeRe: /combx|comment|contact|foot|footer|footnote|link|media|meta|promo|related|scroll|shoutbox|sponsor|utility|tags|widget/i,
  divToPElementsRe: /<(a|blockquote|dl|div|img|ol|p|pre|table|ul)/i,
  replaceBrsRe: /(<br[^>]*>[ \n\r\t]*){2,}/gi,
  replaceFontsRe: /<(\/?)font[^>]*>/gi,
  trimRe: /^\s+|\s+$/g,
  normalizeRe: /\s{2,}/g,
  killBreaksRe: /(<br\s*\/?>(\s|&nbsp;?)*){1,}/g,
  videoRe: /http:\/\/(www\.)?(youtube|vimeo|youku|tudou|56|yinyuetai)\.com/i
};

var dbg;
exports.debug = function (debug) {
  dbg = debug ? console.log : function () {};
};

var cleanRules = [];

module.exports.setCleanRules = function (rules) {
  cleanRules = rules;
};

/**
 * Prepare the HTML document for readability to scrape it.
 * This includes things like stripping javascript, CSS, and handling terrible markup.
 *
 * @return void
 **/
var prepDocument = module.exports.prepDocument = function (document) {
  var frames = document.getElementsByTagName('frame');
  if (frames.length > 0) {
    var bestFrame = null;
    var bestFrameSize = 0;

    Array.prototype.slice.call(frames, 0).forEach(function (frame) {
      var frameSize = frame.offsetWidth + frame.offsetHeight;
      var canAccessFrame = false;
      try {
        frame.contentWindow.document.body;
        canAccessFrame = true;
      } catch (e) {}

      if (canAccessFrame && frameSize > bestFrameSize) {
        bestFrame = frame;
        bestFrameSize = frameSize;
      }
    });

    if (bestFrame) {
      var newBody = document.createElement('body');
      newBody.innerHTML = bestFrame.contentWindow.document.body.innerHTML;
      newBody.style.overflow = 'scroll';
      document.body = newBody;

      var frameset = document.getElementsByTagName('frameset')[0];
      if (frameset) {
        frameset.parentNode.removeChild(frameset);
      }
    }
  }

  // turn all double br's into p's
  // note, this is pretty costly as far as processing goes. Maybe optimize later.
  // document.body.innerHTML = document.body.innerHTML.replace(regexps.replaceBrsRe, '</p><p>').replace(regexps.replaceFontsRe, '<$1span>');
};

/***
 * grabArticle - Using a variety of metrics (content score, classname, element types), find the content that is
 *               most likely to be the stuff a user wants to read. Then return it wrapped up in a div.
 *
 * @return Element
 **/
var grabArticle = module.exports.grabArticle = function (document, preserveUnlikelyCandidates) {
  /**
   * First, node prepping. Trash nodes that look cruddy (like ones with the class name "comment", etc), and turn divs
   * into P tags where they have been used inappropriately (as in, where they contain no other block level elements.)
   *
   * Note: Assignment from index for performance. See http://www.peachpit.com/articles/article.aspx?p=31567&seqNum=5
   * TODO: Shouldn't this be a reverse traversal?
   **/
  var nodes = document.getElementsByTagName('*');
  for (var i = 0; i < nodes.length; ++i) {
    var node = nodes[i];
    // Remove unlikely candidates */
    var continueFlag = false;
    if (!preserveUnlikelyCandidates) {
      var unlikelyMatchString = node.className + node.id;
      if (unlikelyMatchString.search(regexps.unlikelyCandidatesRe) !== -1 && unlikelyMatchString.search(regexps.okMaybeItsACandidateRe) == -1 && node.tagName !== 'HTML' && node.tagName !== "BODY") {
        dbg("Removing unlikely candidate - " + unlikelyMatchString);
        node.parentNode.removeChild(node);
        continueFlag = true;
      }
    }

    // Turn all divs that don't have children block level elements into p's
    if (!continueFlag && node.tagName === 'DIV') {
      if (node.innerHTML.search(regexps.divToPElementsRe) === -1) {
        dbg("Altering div to p");
        var newNode = document.createElement('p');
        newNode.innerHTML = node.innerHTML;
        node.parentNode.replaceChild(newNode, node);
      } else {
        // EXPERIMENTAL

        /*
        node.childNodes._toArray().forEach(function(childNode) {
          if (childNode.nodeType == 3 ) {
            // use span instead of p. Need more tests.
            dbg("replacing text node with a span tag with the same content.");
            var span = document.createElement('span');
            span.innerHTML = childNode.nodeValue;
            childNode.parentNode.replaceChild(span, childNode);
          }
        });
        */

      }
    }
  }

  /**
   * Loop through all paragraphs, and assign a score to them based on how content-y they look.
   * Then add their score to their parent node.
   *
   * A score is determined by things like number of commas, class names, etc. Maybe eventually link density.
   **/
  var allParagraphs = document.getElementsByTagName("p");
  var candidates = [];

  for (var i = 0; i < allParagraphs.length; ++i) {
    var paragraph = allParagraphs[i];
    var parentNode = paragraph.parentNode;
    var grandParentNode = parentNode.parentNode;
    var innerText = getInnerText(paragraph);

    // If this paragraph is less than 25 characters, don't even count it.
    if (innerText.length < 25) continue;

    // Initialize readability data for the parent.
    if (typeof parentNode.readability == 'undefined') {
      initializeNode(parentNode);
      candidates.push(parentNode);
    }

    // Initialize readability data for the grandparent.
    if (typeof grandParentNode.readability == 'undefined') {
      initializeNode(grandParentNode);
      candidates.push(grandParentNode);
    }

    var contentScore = 0;

    // Add a point for the paragraph itself as a base. */
    ++contentScore;

    // Add points for any commas within this paragraph */
    contentScore += innerText.replace('，', ',').split(',').length;

    // For every 100 characters in this paragraph, add another point. Up to 3 points. */
    contentScore += Math.min(Math.floor(innerText.length / 100), 3);

    // Add the score to the parent. The grandparent gets half. */
    parentNode.readability.contentScore += contentScore;
    grandParentNode.readability.contentScore += contentScore / 2;
  }

  /**
   * After we've calculated scores, loop through all of the possible candidate nodes we found
   * and find the one with the highest score.
   **/
  var topCandidate = null;
  candidates.forEach(function (candidate) {
    /**
     * Scale the final candidates score based on link density. Good content should have a
     * relatively small link density (5% or less) and be mostly unaffected by this operation.
     **/
    candidate.readability.contentScore = candidate.readability.contentScore * (1 - getLinkDensity(candidate));

    dbg('Candidate: ' + candidate + " (" + candidate.className + ":" + candidate.id + ") with score " + candidate.readability.contentScore);

    if (!topCandidate || candidate.readability.contentScore > topCandidate.readability.contentScore) topCandidate = candidate;
  });

  /**
   * If we still have no top candidate, just use the body as a last resort.
   * We also have to copy the body node so it is something we can modify.
   **/
  if (topCandidate === null || topCandidate.tagName === 'BODY') {
    // With no top candidate, bail out if no body tag exists as last resort.
    if (!document.body) {
      return new Error('No body tag was found.');
    }
    topCandidate = document.createElement('DIV');
    topCandidate.innerHTML = document.body.innerHTML;
    document.body.innerHTML = '';
    document.body.appendChild(topCandidate);
    initializeNode(topCandidate);
  }

  /**
   * Now that we have the top candidate, look through its siblings for content that might also be related.
   * Things like preambles, content split by ads that we removed, etc.
   **/
  var articleContent = document.createElement('DIV');
  articleContent.id = 'readability-content';
  var siblingScoreThreshold = Math.max(10, topCandidate.readability.contentScore * 0.2);
  var siblingNodes = topCandidate.parentNode.childNodes;
  for (var i = 0, il = siblingNodes.length; i < il; i++) {
    var siblingNode = siblingNodes[i];
    var append = false;

    dbg('Looking at sibling node: ' + siblingNode + ' (' + siblingNode.className + ':' + siblingNode.id + ')' + (typeof siblingNode.readability != 'undefined' ? ' with score ' + siblingNode.readability.contentScore : ''));
    dbg('Sibling has score ' + (siblingNode.readability ? siblingNode.readability.contentScore : 'Unknown'));

    if (siblingNode === topCandidate) {
      append = true;
    }

    if (typeof siblingNode.readability != 'undefined' && siblingNode.readability.contentScore >= siblingScoreThreshold) {
      append = true;
    }

    if (siblingNode.nodeName == 'P') {
      var linkDensity = getLinkDensity(siblingNode);
      var nodeContent = getInnerText(siblingNode);
      var nodeLength = nodeContent.length;

      if (nodeLength > 80 && linkDensity < 0.25) {
        append = true;
      } else if (nodeLength < 80 && linkDensity === 0 && nodeContent.search(/\.( |$)/) !== -1) {
        append = true;
      }
    }

    if (append) {
      dbg("Appending node: " + siblingNode);

      /* Append sibling and subtract from our list because it removes the node when you append to another node */
      articleContent.appendChild(siblingNode);
      i--;
      il--;
    }
  }

  /**
   * So we have all of the content that we need. Now we clean it up for presentation.
   **/
  prepArticle(articleContent);

  return articleContent;
};

/**
 * Remove the style attribute on every e and under.
 *
 * @param Element
 * @return void
 **/
function cleanStyles(e) {
  if (!e) return;

  // Remove any root styles, if we're able.
  if (typeof e.removeAttribute == 'function' && e.className != 'readability-styled') e.removeAttribute('style');

  // Go until there are no more child nodes
  var cur = e.firstChild;
  while (cur) {
    if (cur.nodeType == 1) {
      // Remove style attribute(s) :
      if (cur.className != "readability-styled") {
        cur.removeAttribute("style");
      }
      cleanStyles(cur);
    }
    cur = cur.nextSibling;
  }
}

/**
 * Remove extraneous break tags from a node.
 *
 * @param Element
 * @return void
 **/
function killBreaks(e) {
  e.innerHTML = e.innerHTML.replace(regexps.killBreaksRe, '<br />');
}

/**
 * Get the inner text of a node - cross browser compatibly.
 * This also strips out any excess whitespace to be found.
 *
 * @param Element
 * @return string
 **/
var getInnerText = module.exports.getInnerText = function (e, normalizeSpaces) {
  var textContent = "";

  normalizeSpaces = typeof normalizeSpaces == 'undefined' ? true : normalizeSpaces;

  textContent = e.textContent.trim();

  if (normalizeSpaces) return textContent.replace(regexps.normalizeRe, " ");else return textContent;
};

/**
 * Get the number of times a string s appears in the node e.
 *
 * @param Element
 * @param string - what to split on. Default is ","
 * @return number (integer)
 **/
function getCharCount(e, s) {
  s = s || ",";
  return getInnerText(e).split(s).length;
}

/**
 * Get the density of links as a percentage of the content
 * This is the amount of text that is inside a link divided by the total text in the node.
 *
 * @param Element
 * @return number (float)
 **/
function getLinkDensity(e) {
  var links = e.getElementsByTagName("a");

  var textLength = getInnerText(e).length;
  var linkLength = 0;
  for (var i = 0, il = links.length; i < il; i++) {
    var href = links[i].getAttribute('href');
    // hack for <h2><a href="#menu"></a></h2> / <h2><a></a></h2>
    if (!href || href.length > 0 && href[0] === '#') continue;
    linkLength += getInnerText(links[i]).length;
  }
  return linkLength / textLength;
}

/**
 * Get an elements class/id weight. Uses regular expressions to tell if this
 * element looks good or bad.
 *
 * @param Element
 * @return number (Integer)
 **/
function getClassWeight(e) {
  var weight = 0;

  /* Look for a special classname */
  if (e.className !== '') {
    if (e.className.search(regexps.negativeRe) !== -1) weight -= 25;

    if (e.className.search(regexps.positiveRe) !== -1) weight += 25;
  }

  /* Look for a special ID */
  if (typeof e.id == 'string' && e.id != "") {
    if (e.id.search(regexps.negativeRe) !== -1) weight -= 25;

    if (e.id.search(regexps.positiveRe) !== -1) weight += 25;
  }

  return weight;
}

/**
 * Clean a node of all elements of type "tag".
 * (Unless it's a youtube/vimeo video. People love movies.)
 *
 * @param Element
 * @param string tag to clean
 * @return void
 **/
function clean(e, tag) {
  var targetList = e.getElementsByTagName(tag);
  var isEmbed = tag == 'object' || tag == 'embed';

  for (var y = targetList.length - 1; y >= 0; y--) {
    //------- user clean handler -----------------
    var validRule = false;
    for (var i = 0; i < cleanRules.length; i++) {
      if (cleanRules[i](targetList[y], tag) === true) {
        validRule = true;
        break;
      }
    }

    if (validRule) {
      continue;
    }
    //------- end user clean handler -----------------

    /* Allow youtube and vimeo videos through as people usually want to see those. */
    if (isEmbed) {
      if (targetList[y].innerHTML.search(regexps.videoRe) !== -1) {
        continue;
      }
    }

    targetList[y].parentNode.removeChild(targetList[y]);
  }
}

/**
 * Clean an element of all tags of type "tag" if they look fishy.
 * "Fishy" is an algorithm based on content length, classnames, link density, number of images & embeds, etc.
 *
 * @return void
 **/
function cleanConditionally(e, tag) {
  var tagsList = e.getElementsByTagName(tag);
  var curTagsLength = tagsList.length;

  /**
   * Gather counts for other typical elements embedded within.
   * Traverse backwards so we can remove nodes at the same time without effecting the traversal.
   *
   * TODO: Consider taking into account original contentScore here.
   **/
  for (var i = curTagsLength - 1; i >= 0; i--) {
    var weight = getClassWeight(tagsList[i]);

    dbg("Cleaning Conditionally " + tagsList[i] + " (" + tagsList[i].className + ":" + tagsList[i].id + ")" + (typeof tagsList[i].readability != 'undefined' ? " with score " + tagsList[i].readability.contentScore : ''));

    if (weight < 0) {
      tagsList[i].parentNode.removeChild(tagsList[i]);
    } else if (getCharCount(tagsList[i], ',') < 10) {
      /**
       * If there are not very many commas, and the number of
       * non-paragraph elements is more than paragraphs or other ominous signs, remove the element.
       **/

      var p = tagsList[i].getElementsByTagName("p").length;
      var img = tagsList[i].getElementsByTagName("img").length;
      var li = tagsList[i].getElementsByTagName("li").length - 100;
      var input = tagsList[i].getElementsByTagName("input").length;

      var embedCount = 0;
      var embeds = tagsList[i].getElementsByTagName("embed");
      for (var ei = 0, il = embeds.length; ei < il; ei++) {
        if (embeds[ei].src && embeds[ei].src.search(regexps.videoRe) == -1) {
          embedCount++;
        }
      }

      var linkDensity = getLinkDensity(tagsList[i]);
      var contentLength = getInnerText(tagsList[i]).length;
      var toRemove = false;

      if (img > p && img > 1) {
        toRemove = true;
      } else if (li > p && tag != "ul" && tag != "ol") {
        toRemove = true;
      } else if (input > Math.floor(p / 3)) {
        toRemove = true;
      } else if (contentLength < 25 && (img == 0 || img > 2)) {
        toRemove = true;
      } else if (weight < 25 && linkDensity > .2) {
        toRemove = true;
      } else if (weight >= 25 && linkDensity > .5) {
        toRemove = true;
      } else if (embedCount == 1 && contentLength < 75 || embedCount > 1) {
        toRemove = true;
      }

      if (toRemove) {
        tagsList[i].parentNode.removeChild(tagsList[i]);
      }
    }
  }
}

/**
 * Converts relative urls to absolute for images and links
 **/
function fixLinks(e) {
  if (!e.ownerDocument.originalURL) {
    return;
  }

  function fixLink(link) {
    var fixed = url.resolve(e.ownerDocument.originalURL, link);
    return fixed;
  }

  var i;
  var imgs = e.getElementsByTagName('img');
  for (i = imgs.length - 1; i >= 0; --i) {
    var src = imgs[i].getAttribute('src');
    if (src) {
      imgs[i].setAttribute('src', fixLink(src));
    }
  }

  var as = e.getElementsByTagName('a');
  for (i = as.length - 1; i >= 0; --i) {
    var href = as[i].getAttribute('href');
    if (href) {
      as[i].setAttribute('href', fixLink(href));
    }
  }
}

/**
 * Clean out spurious headers from an Element. Checks things like classnames and link density.
 *
 * @param Element
 * @return void
 **/
function cleanHeaders(e) {
  for (var headerIndex = 1; headerIndex < 7; headerIndex++) {
    var headers = e.getElementsByTagName('h' + headerIndex);
    for (var i = headers.length - 1; i >= 0; --i) {
      if (getClassWeight(headers[i]) < 0 || getLinkDensity(headers[i]) > 0.33) {
        headers[i].parentNode.removeChild(headers[i]);
      }
    }
  }
}

/**
 * Remove the header that doesn't have next sibling.
 *
 * @param Element
 * @return void
 **/

function cleanSingleHeader(e) {
  for (var headerIndex = 1; headerIndex < 7; headerIndex++) {
    var headers = e.getElementsByTagName('h' + headerIndex);
    for (var i = headers.length - 1; i >= 0; --i) {
      if (headers[i].nextSibling === null) {
        headers[i].parentNode.removeChild(headers[i]);
      }
    }
  }
}

function prepArticle(articleContent) {
  cleanStyles(articleContent);
  killBreaks(articleContent);

  /* Clean out junk from the article content */
  clean(articleContent, 'form');
  clean(articleContent, 'object');
  if (articleContent.getElementsByTagName('h1').length === 1) {
    clean(articleContent, 'h1');
  }
  /**
   * If there is only one h2, they are probably using it
   * as a header and not a subheader, so remove it since we already have a header.
   ***/
  if (articleContent.getElementsByTagName('h2').length === 1) clean(articleContent, "h2");

  clean(articleContent, "iframe");

  cleanHeaders(articleContent);

  /* Do these last as the previous stuff may have removed junk that will affect these */
  cleanConditionally(articleContent, "table");
  cleanConditionally(articleContent, "ul");
  cleanConditionally(articleContent, "div");

  /* Remove extra paragraphs */
  var articleParagraphs = articleContent.getElementsByTagName('p');
  for (var i = articleParagraphs.length - 1; i >= 0; i--) {
    var imgCount = articleParagraphs[i].getElementsByTagName('img').length;
    var embedCount = articleParagraphs[i].getElementsByTagName('embed').length;
    var objectCount = articleParagraphs[i].getElementsByTagName('object').length;

    if (imgCount == 0 && embedCount == 0 && objectCount == 0 && getInnerText(articleParagraphs[i], false) == '') {
      articleParagraphs[i].parentNode.removeChild(articleParagraphs[i]);
    }
  }

  cleanSingleHeader(articleContent);

  try {
    articleContent.innerHTML = articleContent.innerHTML.replace(/<br[^>]*>\s*<p/gi, '<p');
  } catch (e) {
    dbg("Cleaning innerHTML of breaks failed. This is an IE strict-block-elements bug. Ignoring.");
  }

  fixLinks(articleContent);
}

/**
 * Initialize a node with the readability object. Also checks the
 * className/id for special names to add to its score.
 *
 * @param Element
 * @return void
 **/
function initializeNode(node) {
  node.readability = { contentScore: 0 };

  switch (node.tagName) {
    case 'ARTICLE':
      node.readability.contentScore += 10;
      break;

    case 'SECTION':
      node.readability.contentScore += 8;
      break;

    case 'DIV':
      node.readability.contentScore += 5;
      break;

    case 'PRE':
    case 'TD':
    case 'BLOCKQUOTE':
      node.readability.contentScore += 3;
      break;

    case 'ADDRESS':
    case 'OL':
    case 'UL':
    case 'DL':
    case 'DD':
    case 'DT':
    case 'LI':
    case 'FORM':
      node.readability.contentScore -= 3;
      break;

    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
    case 'TH':
      node.readability.contentScore -= 5;
      break;
  }

  if (node.attributes.itemscope) {
    node.readability.contentScore += 5;
    if (node.attributes.itemtype && /blog|post|article/i.test(node.getAttribute('itemtype'))) {
      node.readability.contentScore += 30;
    }
  }

  node.readability.contentScore += getClassWeight(node);
}

},{"./log":12}],18:[function(require,module,exports){
var URLTools,
  hasProp = {}.hasOwnProperty;

URLTools = (function(window, document) {
  return {
    splitFirst: function(string, separator) {
      var index;
      index = string.indexOf(separator);
      if (index >= 0) {
        return [string.substring(0, index), string.substring(index + 1)];
      } else {
        return [string];
      }
    },
    extractQueryString: function(url) {
      return this.splitFirst(url + '', '?')[1] || '';
    },
    extractParams: function(url) {
      var i, j, pair, pairs, params, ref, ref1;
      pairs = this.extractQueryString(url).split("&");
      if (pairs.length === 0 || (pairs.length === 1 && ((ref = pairs[0]) != null ? ref.length : void 0) === 0)) {
        return {};
      }
      params = {};
      for (i = j = 0, ref1 = pairs.length; j < ref1; i = j += 1) {
        if (!(pairs[i].length > 0)) {
          continue;
        }
        pair = this.splitFirst(pairs[i], '=');
        if (pair.length !== 2) {
          continue;
        }
        params[pair[0]] = decodeURIComponent(pair[1].replace(/\+/g, " "));
      }
      return params;
    },
    extractDomain: function(url) {
      var error;
      if (!(url && url.length)) {
        return;
      }
      try {
        return decodeURIComponent(url).split('//')[1].split('/')[0];
      } catch (error) {
        return url;
      }
    },
    extractOrigin: function(url) {
      var host, protocol, splitUrl;
      if (!(url && url.length)) {
        return;
      }
      splitUrl = url.split('//');
      protocol = splitUrl[0].length ? splitUrl[0] : location.protocol;
      host = splitUrl[1].split('/')[0];
      return protocol + "//" + host;
    },
    toQueryString: function(params) {
      var key, result, value;
      result = '';
      if (params) {
        for (key in params) {
          if (!hasProp.call(params, key)) continue;
          value = params[key];
          result += "&" + (encodeURIComponent(key)) + "=" + (encodeURIComponent(value));
        }
      }
      return result.replace('&', '');
    }
  };
})(window, window.document);

module.exports = URLTools;



},{}],19:[function(require,module,exports){
'use strict';

module.exports = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : r & 0x3 | 0x8;
        return v.toString(16);
    });
};

},{}],20:[function(require,module,exports){
window.VIROOL = window.VIROOL || {};

window.VIROOL.namespace = function(ns_string) {
  var i, parent, parts;
  parts = ns_string.split(".");
  parent = window.VIROOL;
  if (parts[0] === "VIROOL") {
    parts = parts.slice(1);
  }
  i = 0;
  while (i < parts.length) {
    if (parent[parts[i]] === undefined) {
      parent[parts[i]] = {};
    }
    parent = parent[parts[i]];
    i += 1;
  }
  return parent;
};

module.exports = window.VIROOL;



},{}],21:[function(require,module,exports){
/*! jQuery v2.1.1 -deprecated,-dimensions,-event-alias,-offset,-wrap | (c) 2005, 2014 jQuery Foundation, Inc. | jquery.org/license */
!function(a,b){"object"==typeof module&&"object"==typeof module.exports?module.exports=a.document?b(a,!0):function(a){if(!a.document)throw new Error("jQuery requires a window with a document");return b(a)}:b(a)}("undefined"!=typeof window?window:this,function(a,b){var c=[],d=c.slice,e=c.concat,f=c.push,g=c.indexOf,h={},i=h.toString,j=h.hasOwnProperty,k={},l=a.document,m="2.1.1 -deprecated,-dimensions,-event-alias,-offset,-wrap",n=function(a,b){return new n.fn.init(a,b)},o=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,p=/^-ms-/,q=/-([\da-z])/gi,r=function(a,b){return b.toUpperCase()};n.fn=n.prototype={jquery:m,constructor:n,selector:"",length:0,toArray:function(){return d.call(this)},get:function(a){return null!=a?0>a?this[a+this.length]:this[a]:d.call(this)},pushStack:function(a){var b=n.merge(this.constructor(),a);return b.prevObject=this,b.context=this.context,b},each:function(a,b){return n.each(this,a,b)},map:function(a){return this.pushStack(n.map(this,function(b,c){return a.call(b,c,b)}))},slice:function(){return this.pushStack(d.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(a){var b=this.length,c=+a+(0>a?b:0);return this.pushStack(c>=0&&b>c?[this[c]]:[])},end:function(){return this.prevObject||this.constructor(null)},push:f,sort:c.sort,splice:c.splice},n.extend=n.fn.extend=function(){var a,b,c,d,e,f,g=arguments[0]||{},h=1,i=arguments.length,j=!1;for("boolean"==typeof g&&(j=g,g=arguments[h]||{},h++),"object"==typeof g||n.isFunction(g)||(g={}),h===i&&(g=this,h--);i>h;h++)if(null!=(a=arguments[h]))for(b in a)c=g[b],d=a[b],g!==d&&(j&&d&&(n.isPlainObject(d)||(e=n.isArray(d)))?(e?(e=!1,f=c&&n.isArray(c)?c:[]):f=c&&n.isPlainObject(c)?c:{},g[b]=n.extend(j,f,d)):void 0!==d&&(g[b]=d));return g},n.extend({expando:"jQuery"+(m+Math.random()).replace(/\D/g,""),isReady:!0,error:function(a){throw new Error(a)},noop:function(){},isFunction:function(a){return"function"===n.type(a)},isArray:Array.isArray,isWindow:function(a){return null!=a&&a===a.window},isNumeric:function(a){return!n.isArray(a)&&a-parseFloat(a)>=0},isPlainObject:function(a){return"object"!==n.type(a)||a.nodeType||n.isWindow(a)?!1:a.constructor&&!j.call(a.constructor.prototype,"isPrototypeOf")?!1:!0},isEmptyObject:function(a){var b;for(b in a)return!1;return!0},type:function(a){return null==a?a+"":"object"==typeof a||"function"==typeof a?h[i.call(a)]||"object":typeof a},globalEval:function(a){var b,c=eval;a=n.trim(a),a&&(1===a.indexOf("use strict")?(b=l.createElement("script"),b.text=a,l.head.appendChild(b).parentNode.removeChild(b)):c(a))},camelCase:function(a){return a.replace(p,"ms-").replace(q,r)},nodeName:function(a,b){return a.nodeName&&a.nodeName.toLowerCase()===b.toLowerCase()},each:function(a,b,c){var d,e=0,f=a.length,g=s(a);if(c){if(g){for(;f>e;e++)if(d=b.apply(a[e],c),d===!1)break}else for(e in a)if(d=b.apply(a[e],c),d===!1)break}else if(g){for(;f>e;e++)if(d=b.call(a[e],e,a[e]),d===!1)break}else for(e in a)if(d=b.call(a[e],e,a[e]),d===!1)break;return a},trim:function(a){return null==a?"":(a+"").replace(o,"")},makeArray:function(a,b){var c=b||[];return null!=a&&(s(Object(a))?n.merge(c,"string"==typeof a?[a]:a):f.call(c,a)),c},inArray:function(a,b,c){return null==b?-1:g.call(b,a,c)},merge:function(a,b){for(var c=+b.length,d=0,e=a.length;c>d;d++)a[e++]=b[d];return a.length=e,a},grep:function(a,b,c){for(var d,e=[],f=0,g=a.length,h=!c;g>f;f++)d=!b(a[f],f),d!==h&&e.push(a[f]);return e},map:function(a,b,c){var d,f=0,g=a.length,h=s(a),i=[];if(h)for(;g>f;f++)d=b(a[f],f,c),null!=d&&i.push(d);else for(f in a)d=b(a[f],f,c),null!=d&&i.push(d);return e.apply([],i)},guid:1,proxy:function(a,b){var c,e,f;return"string"==typeof b&&(c=a[b],b=a,a=c),n.isFunction(a)?(e=d.call(arguments,2),f=function(){return a.apply(b||this,e.concat(d.call(arguments)))},f.guid=a.guid=a.guid||n.guid++,f):void 0},now:Date.now,support:k}),n.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),function(a,b){h["[object "+b+"]"]=b.toLowerCase()});function s(a){var b=a.length,c=n.type(a);return"function"===c||n.isWindow(a)?!1:1===a.nodeType&&b?!0:"array"===c||0===b||"number"==typeof b&&b>0&&b-1 in a}var t=function(a){var b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u="sizzle"+-new Date,v=a.document,w=0,x=0,y=gb(),z=gb(),A=gb(),B=function(a,b){return a===b&&(l=!0),0},C="undefined",D=1<<31,E={}.hasOwnProperty,F=[],G=F.pop,H=F.push,I=F.push,J=F.slice,K=F.indexOf||function(a){for(var b=0,c=this.length;c>b;b++)if(this[b]===a)return b;return-1},L="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",M="[\\x20\\t\\r\\n\\f]",N="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",O=N.replace("w","w#"),P="\\["+M+"*("+N+")(?:"+M+"*([*^$|!~]?=)"+M+"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|("+O+"))|)"+M+"*\\]",Q=":("+N+")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|"+P+")*)|.*)\\)|)",R=new RegExp("^"+M+"+|((?:^|[^\\\\])(?:\\\\.)*)"+M+"+$","g"),S=new RegExp("^"+M+"*,"+M+"*"),T=new RegExp("^"+M+"*([>+~]|"+M+")"+M+"*"),U=new RegExp("="+M+"*([^\\]'\"]*?)"+M+"*\\]","g"),V=new RegExp(Q),W=new RegExp("^"+O+"$"),X={ID:new RegExp("^#("+N+")"),CLASS:new RegExp("^\\.("+N+")"),TAG:new RegExp("^("+N.replace("w","w*")+")"),ATTR:new RegExp("^"+P),PSEUDO:new RegExp("^"+Q),CHILD:new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+M+"*(even|odd|(([+-]|)(\\d*)n|)"+M+"*(?:([+-]|)"+M+"*(\\d+)|))"+M+"*\\)|)","i"),bool:new RegExp("^(?:"+L+")$","i"),needsContext:new RegExp("^"+M+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+M+"*((?:-\\d)?\\d*)"+M+"*\\)|)(?=[^-]|$)","i")},Y=/^(?:input|select|textarea|button)$/i,Z=/^h\d$/i,$=/^[^{]+\{\s*\[native \w/,_=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,ab=/[+~]/,bb=/'|\\/g,cb=new RegExp("\\\\([\\da-f]{1,6}"+M+"?|("+M+")|.)","ig"),db=function(a,b,c){var d="0x"+b-65536;return d!==d||c?b:0>d?String.fromCharCode(d+65536):String.fromCharCode(d>>10|55296,1023&d|56320)};try{I.apply(F=J.call(v.childNodes),v.childNodes),F[v.childNodes.length].nodeType}catch(eb){I={apply:F.length?function(a,b){H.apply(a,J.call(b))}:function(a,b){var c=a.length,d=0;while(a[c++]=b[d++]);a.length=c-1}}}function fb(a,b,d,e){var f,h,j,k,l,o,r,s,w,x;if((b?b.ownerDocument||b:v)!==n&&m(b),b=b||n,d=d||[],!a||"string"!=typeof a)return d;if(1!==(k=b.nodeType)&&9!==k)return[];if(p&&!e){if(f=_.exec(a))if(j=f[1]){if(9===k){if(h=b.getElementById(j),!h||!h.parentNode)return d;if(h.id===j)return d.push(h),d}else if(b.ownerDocument&&(h=b.ownerDocument.getElementById(j))&&t(b,h)&&h.id===j)return d.push(h),d}else{if(f[2])return I.apply(d,b.getElementsByTagName(a)),d;if((j=f[3])&&c.getElementsByClassName&&b.getElementsByClassName)return I.apply(d,b.getElementsByClassName(j)),d}if(c.qsa&&(!q||!q.test(a))){if(s=r=u,w=b,x=9===k&&a,1===k&&"object"!==b.nodeName.toLowerCase()){o=g(a),(r=b.getAttribute("id"))?s=r.replace(bb,"\\$&"):b.setAttribute("id",s),s="[id='"+s+"'] ",l=o.length;while(l--)o[l]=s+qb(o[l]);w=ab.test(a)&&ob(b.parentNode)||b,x=o.join(",")}if(x)try{return I.apply(d,w.querySelectorAll(x)),d}catch(y){}finally{r||b.removeAttribute("id")}}}return i(a.replace(R,"$1"),b,d,e)}function gb(){var a=[];function b(c,e){return a.push(c+" ")>d.cacheLength&&delete b[a.shift()],b[c+" "]=e}return b}function hb(a){return a[u]=!0,a}function ib(a){var b=n.createElement("div");try{return!!a(b)}catch(c){return!1}finally{b.parentNode&&b.parentNode.removeChild(b),b=null}}function jb(a,b){var c=a.split("|"),e=a.length;while(e--)d.attrHandle[c[e]]=b}function kb(a,b){var c=b&&a,d=c&&1===a.nodeType&&1===b.nodeType&&(~b.sourceIndex||D)-(~a.sourceIndex||D);if(d)return d;if(c)while(c=c.nextSibling)if(c===b)return-1;return a?1:-1}function lb(a){return function(b){var c=b.nodeName.toLowerCase();return"input"===c&&b.type===a}}function mb(a){return function(b){var c=b.nodeName.toLowerCase();return("input"===c||"button"===c)&&b.type===a}}function nb(a){return hb(function(b){return b=+b,hb(function(c,d){var e,f=a([],c.length,b),g=f.length;while(g--)c[e=f[g]]&&(c[e]=!(d[e]=c[e]))})})}function ob(a){return a&&typeof a.getElementsByTagName!==C&&a}c=fb.support={},f=fb.isXML=function(a){var b=a&&(a.ownerDocument||a).documentElement;return b?"HTML"!==b.nodeName:!1},m=fb.setDocument=function(a){var b,e=a?a.ownerDocument||a:v,g=e.defaultView;return e!==n&&9===e.nodeType&&e.documentElement?(n=e,o=e.documentElement,p=!f(e),g&&g!==g.top&&(g.addEventListener?g.addEventListener("unload",function(){m()},!1):g.attachEvent&&g.attachEvent("onunload",function(){m()})),c.attributes=ib(function(a){return a.className="i",!a.getAttribute("className")}),c.getElementsByTagName=ib(function(a){return a.appendChild(e.createComment("")),!a.getElementsByTagName("*").length}),c.getElementsByClassName=$.test(e.getElementsByClassName)&&ib(function(a){return a.innerHTML="<div class='a'></div><div class='a i'></div>",a.firstChild.className="i",2===a.getElementsByClassName("i").length}),c.getById=ib(function(a){return o.appendChild(a).id=u,!e.getElementsByName||!e.getElementsByName(u).length}),c.getById?(d.find.ID=function(a,b){if(typeof b.getElementById!==C&&p){var c=b.getElementById(a);return c&&c.parentNode?[c]:[]}},d.filter.ID=function(a){var b=a.replace(cb,db);return function(a){return a.getAttribute("id")===b}}):(delete d.find.ID,d.filter.ID=function(a){var b=a.replace(cb,db);return function(a){var c=typeof a.getAttributeNode!==C&&a.getAttributeNode("id");return c&&c.value===b}}),d.find.TAG=c.getElementsByTagName?function(a,b){return typeof b.getElementsByTagName!==C?b.getElementsByTagName(a):void 0}:function(a,b){var c,d=[],e=0,f=b.getElementsByTagName(a);if("*"===a){while(c=f[e++])1===c.nodeType&&d.push(c);return d}return f},d.find.CLASS=c.getElementsByClassName&&function(a,b){return typeof b.getElementsByClassName!==C&&p?b.getElementsByClassName(a):void 0},r=[],q=[],(c.qsa=$.test(e.querySelectorAll))&&(ib(function(a){a.innerHTML="<select msallowclip=''><option selected=''></option></select>",a.querySelectorAll("[msallowclip^='']").length&&q.push("[*^$]="+M+"*(?:''|\"\")"),a.querySelectorAll("[selected]").length||q.push("\\["+M+"*(?:value|"+L+")"),a.querySelectorAll(":checked").length||q.push(":checked")}),ib(function(a){var b=e.createElement("input");b.setAttribute("type","hidden"),a.appendChild(b).setAttribute("name","D"),a.querySelectorAll("[name=d]").length&&q.push("name"+M+"*[*^$|!~]?="),a.querySelectorAll(":enabled").length||q.push(":enabled",":disabled"),a.querySelectorAll("*,:x"),q.push(",.*:")})),(c.matchesSelector=$.test(s=o.matches||o.webkitMatchesSelector||o.mozMatchesSelector||o.oMatchesSelector||o.msMatchesSelector))&&ib(function(a){c.disconnectedMatch=s.call(a,"div"),s.call(a,"[s!='']:x"),r.push("!=",Q)}),q=q.length&&new RegExp(q.join("|")),r=r.length&&new RegExp(r.join("|")),b=$.test(o.compareDocumentPosition),t=b||$.test(o.contains)?function(a,b){var c=9===a.nodeType?a.documentElement:a,d=b&&b.parentNode;return a===d||!(!d||1!==d.nodeType||!(c.contains?c.contains(d):a.compareDocumentPosition&&16&a.compareDocumentPosition(d)))}:function(a,b){if(b)while(b=b.parentNode)if(b===a)return!0;return!1},B=b?function(a,b){if(a===b)return l=!0,0;var d=!a.compareDocumentPosition-!b.compareDocumentPosition;return d?d:(d=(a.ownerDocument||a)===(b.ownerDocument||b)?a.compareDocumentPosition(b):1,1&d||!c.sortDetached&&b.compareDocumentPosition(a)===d?a===e||a.ownerDocument===v&&t(v,a)?-1:b===e||b.ownerDocument===v&&t(v,b)?1:k?K.call(k,a)-K.call(k,b):0:4&d?-1:1)}:function(a,b){if(a===b)return l=!0,0;var c,d=0,f=a.parentNode,g=b.parentNode,h=[a],i=[b];if(!f||!g)return a===e?-1:b===e?1:f?-1:g?1:k?K.call(k,a)-K.call(k,b):0;if(f===g)return kb(a,b);c=a;while(c=c.parentNode)h.unshift(c);c=b;while(c=c.parentNode)i.unshift(c);while(h[d]===i[d])d++;return d?kb(h[d],i[d]):h[d]===v?-1:i[d]===v?1:0},e):n},fb.matches=function(a,b){return fb(a,null,null,b)},fb.matchesSelector=function(a,b){if((a.ownerDocument||a)!==n&&m(a),b=b.replace(U,"='$1']"),!(!c.matchesSelector||!p||r&&r.test(b)||q&&q.test(b)))try{var d=s.call(a,b);if(d||c.disconnectedMatch||a.document&&11!==a.document.nodeType)return d}catch(e){}return fb(b,n,null,[a]).length>0},fb.contains=function(a,b){return(a.ownerDocument||a)!==n&&m(a),t(a,b)},fb.attr=function(a,b){(a.ownerDocument||a)!==n&&m(a);var e=d.attrHandle[b.toLowerCase()],f=e&&E.call(d.attrHandle,b.toLowerCase())?e(a,b,!p):void 0;return void 0!==f?f:c.attributes||!p?a.getAttribute(b):(f=a.getAttributeNode(b))&&f.specified?f.value:null},fb.error=function(a){throw new Error("Syntax error, unrecognized expression: "+a)},fb.uniqueSort=function(a){var b,d=[],e=0,f=0;if(l=!c.detectDuplicates,k=!c.sortStable&&a.slice(0),a.sort(B),l){while(b=a[f++])b===a[f]&&(e=d.push(f));while(e--)a.splice(d[e],1)}return k=null,a},e=fb.getText=function(a){var b,c="",d=0,f=a.nodeType;if(f){if(1===f||9===f||11===f){if("string"==typeof a.textContent)return a.textContent;for(a=a.firstChild;a;a=a.nextSibling)c+=e(a)}else if(3===f||4===f)return a.nodeValue}else while(b=a[d++])c+=e(b);return c},d=fb.selectors={cacheLength:50,createPseudo:hb,match:X,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(a){return a[1]=a[1].replace(cb,db),a[3]=(a[3]||a[4]||a[5]||"").replace(cb,db),"~="===a[2]&&(a[3]=" "+a[3]+" "),a.slice(0,4)},CHILD:function(a){return a[1]=a[1].toLowerCase(),"nth"===a[1].slice(0,3)?(a[3]||fb.error(a[0]),a[4]=+(a[4]?a[5]+(a[6]||1):2*("even"===a[3]||"odd"===a[3])),a[5]=+(a[7]+a[8]||"odd"===a[3])):a[3]&&fb.error(a[0]),a},PSEUDO:function(a){var b,c=!a[6]&&a[2];return X.CHILD.test(a[0])?null:(a[3]?a[2]=a[4]||a[5]||"":c&&V.test(c)&&(b=g(c,!0))&&(b=c.indexOf(")",c.length-b)-c.length)&&(a[0]=a[0].slice(0,b),a[2]=c.slice(0,b)),a.slice(0,3))}},filter:{TAG:function(a){var b=a.replace(cb,db).toLowerCase();return"*"===a?function(){return!0}:function(a){return a.nodeName&&a.nodeName.toLowerCase()===b}},CLASS:function(a){var b=y[a+" "];return b||(b=new RegExp("(^|"+M+")"+a+"("+M+"|$)"))&&y(a,function(a){return b.test("string"==typeof a.className&&a.className||typeof a.getAttribute!==C&&a.getAttribute("class")||"")})},ATTR:function(a,b,c){return function(d){var e=fb.attr(d,a);return null==e?"!="===b:b?(e+="","="===b?e===c:"!="===b?e!==c:"^="===b?c&&0===e.indexOf(c):"*="===b?c&&e.indexOf(c)>-1:"$="===b?c&&e.slice(-c.length)===c:"~="===b?(" "+e+" ").indexOf(c)>-1:"|="===b?e===c||e.slice(0,c.length+1)===c+"-":!1):!0}},CHILD:function(a,b,c,d,e){var f="nth"!==a.slice(0,3),g="last"!==a.slice(-4),h="of-type"===b;return 1===d&&0===e?function(a){return!!a.parentNode}:function(b,c,i){var j,k,l,m,n,o,p=f!==g?"nextSibling":"previousSibling",q=b.parentNode,r=h&&b.nodeName.toLowerCase(),s=!i&&!h;if(q){if(f){while(p){l=b;while(l=l[p])if(h?l.nodeName.toLowerCase()===r:1===l.nodeType)return!1;o=p="only"===a&&!o&&"nextSibling"}return!0}if(o=[g?q.firstChild:q.lastChild],g&&s){k=q[u]||(q[u]={}),j=k[a]||[],n=j[0]===w&&j[1],m=j[0]===w&&j[2],l=n&&q.childNodes[n];while(l=++n&&l&&l[p]||(m=n=0)||o.pop())if(1===l.nodeType&&++m&&l===b){k[a]=[w,n,m];break}}else if(s&&(j=(b[u]||(b[u]={}))[a])&&j[0]===w)m=j[1];else while(l=++n&&l&&l[p]||(m=n=0)||o.pop())if((h?l.nodeName.toLowerCase()===r:1===l.nodeType)&&++m&&(s&&((l[u]||(l[u]={}))[a]=[w,m]),l===b))break;return m-=e,m===d||m%d===0&&m/d>=0}}},PSEUDO:function(a,b){var c,e=d.pseudos[a]||d.setFilters[a.toLowerCase()]||fb.error("unsupported pseudo: "+a);return e[u]?e(b):e.length>1?(c=[a,a,"",b],d.setFilters.hasOwnProperty(a.toLowerCase())?hb(function(a,c){var d,f=e(a,b),g=f.length;while(g--)d=K.call(a,f[g]),a[d]=!(c[d]=f[g])}):function(a){return e(a,0,c)}):e}},pseudos:{not:hb(function(a){var b=[],c=[],d=h(a.replace(R,"$1"));return d[u]?hb(function(a,b,c,e){var f,g=d(a,null,e,[]),h=a.length;while(h--)(f=g[h])&&(a[h]=!(b[h]=f))}):function(a,e,f){return b[0]=a,d(b,null,f,c),!c.pop()}}),has:hb(function(a){return function(b){return fb(a,b).length>0}}),contains:hb(function(a){return function(b){return(b.textContent||b.innerText||e(b)).indexOf(a)>-1}}),lang:hb(function(a){return W.test(a||"")||fb.error("unsupported lang: "+a),a=a.replace(cb,db).toLowerCase(),function(b){var c;do if(c=p?b.lang:b.getAttribute("xml:lang")||b.getAttribute("lang"))return c=c.toLowerCase(),c===a||0===c.indexOf(a+"-");while((b=b.parentNode)&&1===b.nodeType);return!1}}),target:function(b){var c=a.location&&a.location.hash;return c&&c.slice(1)===b.id},root:function(a){return a===o},focus:function(a){return a===n.activeElement&&(!n.hasFocus||n.hasFocus())&&!!(a.type||a.href||~a.tabIndex)},enabled:function(a){return a.disabled===!1},disabled:function(a){return a.disabled===!0},checked:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&!!a.checked||"option"===b&&!!a.selected},selected:function(a){return a.parentNode&&a.parentNode.selectedIndex,a.selected===!0},empty:function(a){for(a=a.firstChild;a;a=a.nextSibling)if(a.nodeType<6)return!1;return!0},parent:function(a){return!d.pseudos.empty(a)},header:function(a){return Z.test(a.nodeName)},input:function(a){return Y.test(a.nodeName)},button:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&"button"===a.type||"button"===b},text:function(a){var b;return"input"===a.nodeName.toLowerCase()&&"text"===a.type&&(null==(b=a.getAttribute("type"))||"text"===b.toLowerCase())},first:nb(function(){return[0]}),last:nb(function(a,b){return[b-1]}),eq:nb(function(a,b,c){return[0>c?c+b:c]}),even:nb(function(a,b){for(var c=0;b>c;c+=2)a.push(c);return a}),odd:nb(function(a,b){for(var c=1;b>c;c+=2)a.push(c);return a}),lt:nb(function(a,b,c){for(var d=0>c?c+b:c;--d>=0;)a.push(d);return a}),gt:nb(function(a,b,c){for(var d=0>c?c+b:c;++d<b;)a.push(d);return a})}},d.pseudos.nth=d.pseudos.eq;for(b in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})d.pseudos[b]=lb(b);for(b in{submit:!0,reset:!0})d.pseudos[b]=mb(b);function pb(){}pb.prototype=d.filters=d.pseudos,d.setFilters=new pb,g=fb.tokenize=function(a,b){var c,e,f,g,h,i,j,k=z[a+" "];if(k)return b?0:k.slice(0);h=a,i=[],j=d.preFilter;while(h){(!c||(e=S.exec(h)))&&(e&&(h=h.slice(e[0].length)||h),i.push(f=[])),c=!1,(e=T.exec(h))&&(c=e.shift(),f.push({value:c,type:e[0].replace(R," ")}),h=h.slice(c.length));for(g in d.filter)!(e=X[g].exec(h))||j[g]&&!(e=j[g](e))||(c=e.shift(),f.push({value:c,type:g,matches:e}),h=h.slice(c.length));if(!c)break}return b?h.length:h?fb.error(a):z(a,i).slice(0)};function qb(a){for(var b=0,c=a.length,d="";c>b;b++)d+=a[b].value;return d}function rb(a,b,c){var d=b.dir,e=c&&"parentNode"===d,f=x++;return b.first?function(b,c,f){while(b=b[d])if(1===b.nodeType||e)return a(b,c,f)}:function(b,c,g){var h,i,j=[w,f];if(g){while(b=b[d])if((1===b.nodeType||e)&&a(b,c,g))return!0}else while(b=b[d])if(1===b.nodeType||e){if(i=b[u]||(b[u]={}),(h=i[d])&&h[0]===w&&h[1]===f)return j[2]=h[2];if(i[d]=j,j[2]=a(b,c,g))return!0}}}function sb(a){return a.length>1?function(b,c,d){var e=a.length;while(e--)if(!a[e](b,c,d))return!1;return!0}:a[0]}function tb(a,b,c){for(var d=0,e=b.length;e>d;d++)fb(a,b[d],c);return c}function ub(a,b,c,d,e){for(var f,g=[],h=0,i=a.length,j=null!=b;i>h;h++)(f=a[h])&&(!c||c(f,d,e))&&(g.push(f),j&&b.push(h));return g}function vb(a,b,c,d,e,f){return d&&!d[u]&&(d=vb(d)),e&&!e[u]&&(e=vb(e,f)),hb(function(f,g,h,i){var j,k,l,m=[],n=[],o=g.length,p=f||tb(b||"*",h.nodeType?[h]:h,[]),q=!a||!f&&b?p:ub(p,m,a,h,i),r=c?e||(f?a:o||d)?[]:g:q;if(c&&c(q,r,h,i),d){j=ub(r,n),d(j,[],h,i),k=j.length;while(k--)(l=j[k])&&(r[n[k]]=!(q[n[k]]=l))}if(f){if(e||a){if(e){j=[],k=r.length;while(k--)(l=r[k])&&j.push(q[k]=l);e(null,r=[],j,i)}k=r.length;while(k--)(l=r[k])&&(j=e?K.call(f,l):m[k])>-1&&(f[j]=!(g[j]=l))}}else r=ub(r===g?r.splice(o,r.length):r),e?e(null,g,r,i):I.apply(g,r)})}function wb(a){for(var b,c,e,f=a.length,g=d.relative[a[0].type],h=g||d.relative[" "],i=g?1:0,k=rb(function(a){return a===b},h,!0),l=rb(function(a){return K.call(b,a)>-1},h,!0),m=[function(a,c,d){return!g&&(d||c!==j)||((b=c).nodeType?k(a,c,d):l(a,c,d))}];f>i;i++)if(c=d.relative[a[i].type])m=[rb(sb(m),c)];else{if(c=d.filter[a[i].type].apply(null,a[i].matches),c[u]){for(e=++i;f>e;e++)if(d.relative[a[e].type])break;return vb(i>1&&sb(m),i>1&&qb(a.slice(0,i-1).concat({value:" "===a[i-2].type?"*":""})).replace(R,"$1"),c,e>i&&wb(a.slice(i,e)),f>e&&wb(a=a.slice(e)),f>e&&qb(a))}m.push(c)}return sb(m)}function xb(a,b){var c=b.length>0,e=a.length>0,f=function(f,g,h,i,k){var l,m,o,p=0,q="0",r=f&&[],s=[],t=j,u=f||e&&d.find.TAG("*",k),v=w+=null==t?1:Math.random()||.1,x=u.length;for(k&&(j=g!==n&&g);q!==x&&null!=(l=u[q]);q++){if(e&&l){m=0;while(o=a[m++])if(o(l,g,h)){i.push(l);break}k&&(w=v)}c&&((l=!o&&l)&&p--,f&&r.push(l))}if(p+=q,c&&q!==p){m=0;while(o=b[m++])o(r,s,g,h);if(f){if(p>0)while(q--)r[q]||s[q]||(s[q]=G.call(i));s=ub(s)}I.apply(i,s),k&&!f&&s.length>0&&p+b.length>1&&fb.uniqueSort(i)}return k&&(w=v,j=t),r};return c?hb(f):f}return h=fb.compile=function(a,b){var c,d=[],e=[],f=A[a+" "];if(!f){b||(b=g(a)),c=b.length;while(c--)f=wb(b[c]),f[u]?d.push(f):e.push(f);f=A(a,xb(e,d)),f.selector=a}return f},i=fb.select=function(a,b,e,f){var i,j,k,l,m,n="function"==typeof a&&a,o=!f&&g(a=n.selector||a);if(e=e||[],1===o.length){if(j=o[0]=o[0].slice(0),j.length>2&&"ID"===(k=j[0]).type&&c.getById&&9===b.nodeType&&p&&d.relative[j[1].type]){if(b=(d.find.ID(k.matches[0].replace(cb,db),b)||[])[0],!b)return e;n&&(b=b.parentNode),a=a.slice(j.shift().value.length)}i=X.needsContext.test(a)?0:j.length;while(i--){if(k=j[i],d.relative[l=k.type])break;if((m=d.find[l])&&(f=m(k.matches[0].replace(cb,db),ab.test(j[0].type)&&ob(b.parentNode)||b))){if(j.splice(i,1),a=f.length&&qb(j),!a)return I.apply(e,f),e;break}}}return(n||h(a,o))(f,b,!p,e,ab.test(a)&&ob(b.parentNode)||b),e},c.sortStable=u.split("").sort(B).join("")===u,c.detectDuplicates=!!l,m(),c.sortDetached=ib(function(a){return 1&a.compareDocumentPosition(n.createElement("div"))}),ib(function(a){return a.innerHTML="<a href='#'></a>","#"===a.firstChild.getAttribute("href")})||jb("type|href|height|width",function(a,b,c){return c?void 0:a.getAttribute(b,"type"===b.toLowerCase()?1:2)}),c.attributes&&ib(function(a){return a.innerHTML="<input/>",a.firstChild.setAttribute("value",""),""===a.firstChild.getAttribute("value")})||jb("value",function(a,b,c){return c||"input"!==a.nodeName.toLowerCase()?void 0:a.defaultValue}),ib(function(a){return null==a.getAttribute("disabled")})||jb(L,function(a,b,c){var d;return c?void 0:a[b]===!0?b.toLowerCase():(d=a.getAttributeNode(b))&&d.specified?d.value:null}),fb}(a);n.find=t,n.expr=t.selectors,n.expr[":"]=n.expr.pseudos,n.unique=t.uniqueSort,n.text=t.getText,n.isXMLDoc=t.isXML,n.contains=t.contains;var u=n.expr.match.needsContext,v=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,w=/^.[^:#\[\.,]*$/;function x(a,b,c){if(n.isFunction(b))return n.grep(a,function(a,d){return!!b.call(a,d,a)!==c});if(b.nodeType)return n.grep(a,function(a){return a===b!==c});if("string"==typeof b){if(w.test(b))return n.filter(b,a,c);b=n.filter(b,a)}return n.grep(a,function(a){return g.call(b,a)>=0!==c})}n.filter=function(a,b,c){var d=b[0];return c&&(a=":not("+a+")"),1===b.length&&1===d.nodeType?n.find.matchesSelector(d,a)?[d]:[]:n.find.matches(a,n.grep(b,function(a){return 1===a.nodeType}))},n.fn.extend({find:function(a){var b,c=this.length,d=[],e=this;if("string"!=typeof a)return this.pushStack(n(a).filter(function(){for(b=0;c>b;b++)if(n.contains(e[b],this))return!0}));for(b=0;c>b;b++)n.find(a,e[b],d);return d=this.pushStack(c>1?n.unique(d):d),d.selector=this.selector?this.selector+" "+a:a,d},filter:function(a){return this.pushStack(x(this,a||[],!1))},not:function(a){return this.pushStack(x(this,a||[],!0))},is:function(a){return!!x(this,"string"==typeof a&&u.test(a)?n(a):a||[],!1).length}});var y,z=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,A=n.fn.init=function(a,b){var c,d;if(!a)return this;if("string"==typeof a){if(c="<"===a[0]&&">"===a[a.length-1]&&a.length>=3?[null,a,null]:z.exec(a),!c||!c[1]&&b)return!b||b.jquery?(b||y).find(a):this.constructor(b).find(a);if(c[1]){if(b=b instanceof n?b[0]:b,n.merge(this,n.parseHTML(c[1],b&&b.nodeType?b.ownerDocument||b:l,!0)),v.test(c[1])&&n.isPlainObject(b))for(c in b)n.isFunction(this[c])?this[c](b[c]):this.attr(c,b[c]);return this}return d=l.getElementById(c[2]),d&&d.parentNode&&(this.length=1,this[0]=d),this.context=l,this.selector=a,this}return a.nodeType?(this.context=this[0]=a,this.length=1,this):n.isFunction(a)?"undefined"!=typeof y.ready?y.ready(a):a(n):(void 0!==a.selector&&(this.selector=a.selector,this.context=a.context),n.makeArray(a,this))};A.prototype=n.fn,y=n(l);var B=/^(?:parents|prev(?:Until|All))/,C={children:!0,contents:!0,next:!0,prev:!0};n.extend({dir:function(a,b,c){var d=[],e=void 0!==c;while((a=a[b])&&9!==a.nodeType)if(1===a.nodeType){if(e&&n(a).is(c))break;d.push(a)}return d},sibling:function(a,b){for(var c=[];a;a=a.nextSibling)1===a.nodeType&&a!==b&&c.push(a);return c}}),n.fn.extend({has:function(a){var b=n(a,this),c=b.length;return this.filter(function(){for(var a=0;c>a;a++)if(n.contains(this,b[a]))return!0})},closest:function(a,b){for(var c,d=0,e=this.length,f=[],g=u.test(a)||"string"!=typeof a?n(a,b||this.context):0;e>d;d++)for(c=this[d];c&&c!==b;c=c.parentNode)if(c.nodeType<11&&(g?g.index(c)>-1:1===c.nodeType&&n.find.matchesSelector(c,a))){f.push(c);break}return this.pushStack(f.length>1?n.unique(f):f)},index:function(a){return a?"string"==typeof a?g.call(n(a),this[0]):g.call(this,a.jquery?a[0]:a):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(a,b){return this.pushStack(n.unique(n.merge(this.get(),n(a,b))))},addBack:function(a){return this.add(null==a?this.prevObject:this.prevObject.filter(a))}});function D(a,b){while((a=a[b])&&1!==a.nodeType);return a}n.each({parent:function(a){var b=a.parentNode;return b&&11!==b.nodeType?b:null},parents:function(a){return n.dir(a,"parentNode")},parentsUntil:function(a,b,c){return n.dir(a,"parentNode",c)},next:function(a){return D(a,"nextSibling")},prev:function(a){return D(a,"previousSibling")},nextAll:function(a){return n.dir(a,"nextSibling")},prevAll:function(a){return n.dir(a,"previousSibling")},nextUntil:function(a,b,c){return n.dir(a,"nextSibling",c)},prevUntil:function(a,b,c){return n.dir(a,"previousSibling",c)},siblings:function(a){return n.sibling((a.parentNode||{}).firstChild,a)},children:function(a){return n.sibling(a.firstChild)},contents:function(a){return a.contentDocument||n.merge([],a.childNodes)}},function(a,b){n.fn[a]=function(c,d){var e=n.map(this,b,c);return"Until"!==a.slice(-5)&&(d=c),d&&"string"==typeof d&&(e=n.filter(d,e)),this.length>1&&(C[a]||n.unique(e),B.test(a)&&e.reverse()),this.pushStack(e)}});var E=/\S+/g,F={};function G(a){var b=F[a]={};return n.each(a.match(E)||[],function(a,c){b[c]=!0}),b}n.Callbacks=function(a){a="string"==typeof a?F[a]||G(a):n.extend({},a);var b,c,d,e,f,g,h=[],i=!a.once&&[],j=function(l){for(b=a.memory&&l,c=!0,g=e||0,e=0,f=h.length,d=!0;h&&f>g;g++)if(h[g].apply(l[0],l[1])===!1&&a.stopOnFalse){b=!1;break}d=!1,h&&(i?i.length&&j(i.shift()):b?h=[]:k.disable())},k={add:function(){if(h){var c=h.length;!function g(b){n.each(b,function(b,c){var d=n.type(c);"function"===d?a.unique&&k.has(c)||h.push(c):c&&c.length&&"string"!==d&&g(c)})}(arguments),d?f=h.length:b&&(e=c,j(b))}return this},remove:function(){return h&&n.each(arguments,function(a,b){var c;while((c=n.inArray(b,h,c))>-1)h.splice(c,1),d&&(f>=c&&f--,g>=c&&g--)}),this},has:function(a){return a?n.inArray(a,h)>-1:!(!h||!h.length)},empty:function(){return h=[],f=0,this},disable:function(){return h=i=b=void 0,this},disabled:function(){return!h},lock:function(){return i=void 0,b||k.disable(),this},locked:function(){return!i},fireWith:function(a,b){return!h||c&&!i||(b=b||[],b=[a,b.slice?b.slice():b],d?i.push(b):j(b)),this},fire:function(){return k.fireWith(this,arguments),this},fired:function(){return!!c}};return k},n.extend({Deferred:function(a){var b=[["resolve","done",n.Callbacks("once memory"),"resolved"],["reject","fail",n.Callbacks("once memory"),"rejected"],["notify","progress",n.Callbacks("memory")]],c="pending",d={state:function(){return c},always:function(){return e.done(arguments).fail(arguments),this},then:function(){var a=arguments;return n.Deferred(function(c){n.each(b,function(b,f){var g=n.isFunction(a[b])&&a[b];e[f[1]](function(){var a=g&&g.apply(this,arguments);a&&n.isFunction(a.promise)?a.promise().done(c.resolve).fail(c.reject).progress(c.notify):c[f[0]+"With"](this===d?c.promise():this,g?[a]:arguments)})}),a=null}).promise()},promise:function(a){return null!=a?n.extend(a,d):d}},e={};return d.pipe=d.then,n.each(b,function(a,f){var g=f[2],h=f[3];d[f[1]]=g.add,h&&g.add(function(){c=h},b[1^a][2].disable,b[2][2].lock),e[f[0]]=function(){return e[f[0]+"With"](this===e?d:this,arguments),this},e[f[0]+"With"]=g.fireWith}),d.promise(e),a&&a.call(e,e),e},when:function(a){var b=0,c=d.call(arguments),e=c.length,f=1!==e||a&&n.isFunction(a.promise)?e:0,g=1===f?a:n.Deferred(),h=function(a,b,c){return function(e){b[a]=this,c[a]=arguments.length>1?d.call(arguments):e,c===i?g.notifyWith(b,c):--f||g.resolveWith(b,c)}},i,j,k;if(e>1)for(i=new Array(e),j=new Array(e),k=new Array(e);e>b;b++)c[b]&&n.isFunction(c[b].promise)?c[b].promise().done(h(b,k,c)).fail(g.reject).progress(h(b,j,i)):--f;return f||g.resolveWith(k,c),g.promise()}});var H;n.fn.ready=function(a){return n.ready.promise().done(a),this},n.extend({isReady:!1,readyWait:1,holdReady:function(a){a?n.readyWait++:n.ready(!0)},ready:function(a){(a===!0?--n.readyWait:n.isReady)||(n.isReady=!0,a!==!0&&--n.readyWait>0||(H.resolveWith(l,[n]),n.fn.triggerHandler&&(n(l).triggerHandler("ready"),n(l).off("ready"))))}});function I(){l.removeEventListener("DOMContentLoaded",I,!1),a.removeEventListener("load",I,!1),n.ready()}n.ready.promise=function(b){return H||(H=n.Deferred(),"complete"===l.readyState?setTimeout(n.ready):(l.addEventListener("DOMContentLoaded",I,!1),a.addEventListener("load",I,!1))),H.promise(b)},n.ready.promise();var J=n.access=function(a,b,c,d,e,f,g){var h=0,i=a.length,j=null==c;if("object"===n.type(c)){e=!0;for(h in c)n.access(a,b,h,c[h],!0,f,g)}else if(void 0!==d&&(e=!0,n.isFunction(d)||(g=!0),j&&(g?(b.call(a,d),b=null):(j=b,b=function(a,b,c){return j.call(n(a),c)})),b))for(;i>h;h++)b(a[h],c,g?d:d.call(a[h],h,b(a[h],c)));return e?a:j?b.call(a):i?b(a[0],c):f};n.acceptData=function(a){return 1===a.nodeType||9===a.nodeType||!+a.nodeType};function K(){Object.defineProperty(this.cache={},0,{get:function(){return{}}}),this.expando=n.expando+Math.random()}K.uid=1,K.accepts=n.acceptData,K.prototype={key:function(a){if(!K.accepts(a))return 0;var b={},c=a[this.expando];if(!c){c=K.uid++;try{b[this.expando]={value:c},Object.defineProperties(a,b)}catch(d){b[this.expando]=c,n.extend(a,b)}}return this.cache[c]||(this.cache[c]={}),c},set:function(a,b,c){var d,e=this.key(a),f=this.cache[e];if("string"==typeof b)f[b]=c;else if(n.isEmptyObject(f))n.extend(this.cache[e],b);else for(d in b)f[d]=b[d];return f},get:function(a,b){var c=this.cache[this.key(a)];return void 0===b?c:c[b]},access:function(a,b,c){var d;return void 0===b||b&&"string"==typeof b&&void 0===c?(d=this.get(a,b),void 0!==d?d:this.get(a,n.camelCase(b))):(this.set(a,b,c),void 0!==c?c:b)},remove:function(a,b){var c,d,e,f=this.key(a),g=this.cache[f];if(void 0===b)this.cache[f]={};else{n.isArray(b)?d=b.concat(b.map(n.camelCase)):(e=n.camelCase(b),b in g?d=[b,e]:(d=e,d=d in g?[d]:d.match(E)||[])),c=d.length;while(c--)delete g[d[c]]}},hasData:function(a){return!n.isEmptyObject(this.cache[a[this.expando]]||{})},discard:function(a){a[this.expando]&&delete this.cache[a[this.expando]]}};var L=new K,M=new K,N=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,O=/([A-Z])/g;function P(a,b,c){var d;if(void 0===c&&1===a.nodeType)if(d="data-"+b.replace(O,"-$1").toLowerCase(),c=a.getAttribute(d),"string"==typeof c){try{c="true"===c?!0:"false"===c?!1:"null"===c?null:+c+""===c?+c:N.test(c)?n.parseJSON(c):c}catch(e){}M.set(a,b,c)}else c=void 0;return c}n.extend({hasData:function(a){return M.hasData(a)||L.hasData(a)},data:function(a,b,c){return M.access(a,b,c)
},removeData:function(a,b){M.remove(a,b)},_data:function(a,b,c){return L.access(a,b,c)},_removeData:function(a,b){L.remove(a,b)}}),n.fn.extend({data:function(a,b){var c,d,e,f=this[0],g=f&&f.attributes;if(void 0===a){if(this.length&&(e=M.get(f),1===f.nodeType&&!L.get(f,"hasDataAttrs"))){c=g.length;while(c--)g[c]&&(d=g[c].name,0===d.indexOf("data-")&&(d=n.camelCase(d.slice(5)),P(f,d,e[d])));L.set(f,"hasDataAttrs",!0)}return e}return"object"==typeof a?this.each(function(){M.set(this,a)}):J(this,function(b){var c,d=n.camelCase(a);if(f&&void 0===b){if(c=M.get(f,a),void 0!==c)return c;if(c=M.get(f,d),void 0!==c)return c;if(c=P(f,d,void 0),void 0!==c)return c}else this.each(function(){var c=M.get(this,d);M.set(this,d,b),-1!==a.indexOf("-")&&void 0!==c&&M.set(this,a,b)})},null,b,arguments.length>1,null,!0)},removeData:function(a){return this.each(function(){M.remove(this,a)})}}),n.extend({queue:function(a,b,c){var d;return a?(b=(b||"fx")+"queue",d=L.get(a,b),c&&(!d||n.isArray(c)?d=L.access(a,b,n.makeArray(c)):d.push(c)),d||[]):void 0},dequeue:function(a,b){b=b||"fx";var c=n.queue(a,b),d=c.length,e=c.shift(),f=n._queueHooks(a,b),g=function(){n.dequeue(a,b)};"inprogress"===e&&(e=c.shift(),d--),e&&("fx"===b&&c.unshift("inprogress"),delete f.stop,e.call(a,g,f)),!d&&f&&f.empty.fire()},_queueHooks:function(a,b){var c=b+"queueHooks";return L.get(a,c)||L.access(a,c,{empty:n.Callbacks("once memory").add(function(){L.remove(a,[b+"queue",c])})})}}),n.fn.extend({queue:function(a,b){var c=2;return"string"!=typeof a&&(b=a,a="fx",c--),arguments.length<c?n.queue(this[0],a):void 0===b?this:this.each(function(){var c=n.queue(this,a,b);n._queueHooks(this,a),"fx"===a&&"inprogress"!==c[0]&&n.dequeue(this,a)})},dequeue:function(a){return this.each(function(){n.dequeue(this,a)})},clearQueue:function(a){return this.queue(a||"fx",[])},promise:function(a,b){var c,d=1,e=n.Deferred(),f=this,g=this.length,h=function(){--d||e.resolveWith(f,[f])};"string"!=typeof a&&(b=a,a=void 0),a=a||"fx";while(g--)c=L.get(f[g],a+"queueHooks"),c&&c.empty&&(d++,c.empty.add(h));return h(),e.promise(b)}});var Q=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,R=["Top","Right","Bottom","Left"],S=function(a,b){return a=b||a,"none"===n.css(a,"display")||!n.contains(a.ownerDocument,a)},T=/^(?:checkbox|radio)$/i;!function(){var a=l.createDocumentFragment(),b=a.appendChild(l.createElement("div")),c=l.createElement("input");c.setAttribute("type","radio"),c.setAttribute("checked","checked"),c.setAttribute("name","t"),b.appendChild(c),k.checkClone=b.cloneNode(!0).cloneNode(!0).lastChild.checked,b.innerHTML="<textarea>x</textarea>",k.noCloneChecked=!!b.cloneNode(!0).lastChild.defaultValue}();var U="undefined";k.focusinBubbles="onfocusin"in a;var V=/^key/,W=/^(?:mouse|pointer|contextmenu)|click/,X=/^(?:focusinfocus|focusoutblur)$/,Y=/^([^.]*)(?:\.(.+)|)$/;function Z(){return!0}function $(){return!1}function _(){try{return l.activeElement}catch(a){}}n.event={global:{},add:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,o,p,q,r=L.get(a);if(r){c.handler&&(f=c,c=f.handler,e=f.selector),c.guid||(c.guid=n.guid++),(i=r.events)||(i=r.events={}),(g=r.handle)||(g=r.handle=function(b){return typeof n!==U&&n.event.triggered!==b.type?n.event.dispatch.apply(a,arguments):void 0}),b=(b||"").match(E)||[""],j=b.length;while(j--)h=Y.exec(b[j])||[],o=q=h[1],p=(h[2]||"").split(".").sort(),o&&(l=n.event.special[o]||{},o=(e?l.delegateType:l.bindType)||o,l=n.event.special[o]||{},k=n.extend({type:o,origType:q,data:d,handler:c,guid:c.guid,selector:e,needsContext:e&&n.expr.match.needsContext.test(e),namespace:p.join(".")},f),(m=i[o])||(m=i[o]=[],m.delegateCount=0,l.setup&&l.setup.call(a,d,p,g)!==!1||a.addEventListener&&a.addEventListener(o,g,!1)),l.add&&(l.add.call(a,k),k.handler.guid||(k.handler.guid=c.guid)),e?m.splice(m.delegateCount++,0,k):m.push(k),n.event.global[o]=!0)}},remove:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,o,p,q,r=L.hasData(a)&&L.get(a);if(r&&(i=r.events)){b=(b||"").match(E)||[""],j=b.length;while(j--)if(h=Y.exec(b[j])||[],o=q=h[1],p=(h[2]||"").split(".").sort(),o){l=n.event.special[o]||{},o=(d?l.delegateType:l.bindType)||o,m=i[o]||[],h=h[2]&&new RegExp("(^|\\.)"+p.join("\\.(?:.*\\.|)")+"(\\.|$)"),g=f=m.length;while(f--)k=m[f],!e&&q!==k.origType||c&&c.guid!==k.guid||h&&!h.test(k.namespace)||d&&d!==k.selector&&("**"!==d||!k.selector)||(m.splice(f,1),k.selector&&m.delegateCount--,l.remove&&l.remove.call(a,k));g&&!m.length&&(l.teardown&&l.teardown.call(a,p,r.handle)!==!1||n.removeEvent(a,o,r.handle),delete i[o])}else for(o in i)n.event.remove(a,o+b[j],c,d,!0);n.isEmptyObject(i)&&(delete r.handle,L.remove(a,"events"))}},trigger:function(b,c,d,e){var f,g,h,i,k,m,o,p=[d||l],q=j.call(b,"type")?b.type:b,r=j.call(b,"namespace")?b.namespace.split("."):[];if(g=h=d=d||l,3!==d.nodeType&&8!==d.nodeType&&!X.test(q+n.event.triggered)&&(q.indexOf(".")>=0&&(r=q.split("."),q=r.shift(),r.sort()),k=q.indexOf(":")<0&&"on"+q,b=b[n.expando]?b:new n.Event(q,"object"==typeof b&&b),b.isTrigger=e?2:3,b.namespace=r.join("."),b.namespace_re=b.namespace?new RegExp("(^|\\.)"+r.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,b.result=void 0,b.target||(b.target=d),c=null==c?[b]:n.makeArray(c,[b]),o=n.event.special[q]||{},e||!o.trigger||o.trigger.apply(d,c)!==!1)){if(!e&&!o.noBubble&&!n.isWindow(d)){for(i=o.delegateType||q,X.test(i+q)||(g=g.parentNode);g;g=g.parentNode)p.push(g),h=g;h===(d.ownerDocument||l)&&p.push(h.defaultView||h.parentWindow||a)}f=0;while((g=p[f++])&&!b.isPropagationStopped())b.type=f>1?i:o.bindType||q,m=(L.get(g,"events")||{})[b.type]&&L.get(g,"handle"),m&&m.apply(g,c),m=k&&g[k],m&&m.apply&&n.acceptData(g)&&(b.result=m.apply(g,c),b.result===!1&&b.preventDefault());return b.type=q,e||b.isDefaultPrevented()||o._default&&o._default.apply(p.pop(),c)!==!1||!n.acceptData(d)||k&&n.isFunction(d[q])&&!n.isWindow(d)&&(h=d[k],h&&(d[k]=null),n.event.triggered=q,d[q](),n.event.triggered=void 0,h&&(d[k]=h)),b.result}},dispatch:function(a){a=n.event.fix(a);var b,c,e,f,g,h=[],i=d.call(arguments),j=(L.get(this,"events")||{})[a.type]||[],k=n.event.special[a.type]||{};if(i[0]=a,a.delegateTarget=this,!k.preDispatch||k.preDispatch.call(this,a)!==!1){h=n.event.handlers.call(this,a,j),b=0;while((f=h[b++])&&!a.isPropagationStopped()){a.currentTarget=f.elem,c=0;while((g=f.handlers[c++])&&!a.isImmediatePropagationStopped())(!a.namespace_re||a.namespace_re.test(g.namespace))&&(a.handleObj=g,a.data=g.data,e=((n.event.special[g.origType]||{}).handle||g.handler).apply(f.elem,i),void 0!==e&&(a.result=e)===!1&&(a.preventDefault(),a.stopPropagation()))}return k.postDispatch&&k.postDispatch.call(this,a),a.result}},handlers:function(a,b){var c,d,e,f,g=[],h=b.delegateCount,i=a.target;if(h&&i.nodeType&&(!a.button||"click"!==a.type))for(;i!==this;i=i.parentNode||this)if(i.disabled!==!0||"click"!==a.type){for(d=[],c=0;h>c;c++)f=b[c],e=f.selector+" ",void 0===d[e]&&(d[e]=f.needsContext?n(e,this).index(i)>=0:n.find(e,this,null,[i]).length),d[e]&&d.push(f);d.length&&g.push({elem:i,handlers:d})}return h<b.length&&g.push({elem:this,handlers:b.slice(h)}),g},props:"altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(a,b){return null==a.which&&(a.which=null!=b.charCode?b.charCode:b.keyCode),a}},mouseHooks:{props:"button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(a,b){var c,d,e,f=b.button;return null==a.pageX&&null!=b.clientX&&(c=a.target.ownerDocument||l,d=c.documentElement,e=c.body,a.pageX=b.clientX+(d&&d.scrollLeft||e&&e.scrollLeft||0)-(d&&d.clientLeft||e&&e.clientLeft||0),a.pageY=b.clientY+(d&&d.scrollTop||e&&e.scrollTop||0)-(d&&d.clientTop||e&&e.clientTop||0)),a.which||void 0===f||(a.which=1&f?1:2&f?3:4&f?2:0),a}},fix:function(a){if(a[n.expando])return a;var b,c,d,e=a.type,f=a,g=this.fixHooks[e];g||(this.fixHooks[e]=g=W.test(e)?this.mouseHooks:V.test(e)?this.keyHooks:{}),d=g.props?this.props.concat(g.props):this.props,a=new n.Event(f),b=d.length;while(b--)c=d[b],a[c]=f[c];return a.target||(a.target=l),3===a.target.nodeType&&(a.target=a.target.parentNode),g.filter?g.filter(a,f):a},special:{load:{noBubble:!0},focus:{trigger:function(){return this!==_()&&this.focus?(this.focus(),!1):void 0},delegateType:"focusin"},blur:{trigger:function(){return this===_()&&this.blur?(this.blur(),!1):void 0},delegateType:"focusout"},click:{trigger:function(){return"checkbox"===this.type&&this.click&&n.nodeName(this,"input")?(this.click(),!1):void 0},_default:function(a){return n.nodeName(a.target,"a")}},beforeunload:{postDispatch:function(a){void 0!==a.result&&a.originalEvent&&(a.originalEvent.returnValue=a.result)}}},simulate:function(a,b,c,d){var e=n.extend(new n.Event,c,{type:a,isSimulated:!0,originalEvent:{}});d?n.event.trigger(e,null,b):n.event.dispatch.call(b,e),e.isDefaultPrevented()&&c.preventDefault()}},n.removeEvent=function(a,b,c){a.removeEventListener&&a.removeEventListener(b,c,!1)},n.Event=function(a,b){return this instanceof n.Event?(a&&a.type?(this.originalEvent=a,this.type=a.type,this.isDefaultPrevented=a.defaultPrevented||void 0===a.defaultPrevented&&a.returnValue===!1?Z:$):this.type=a,b&&n.extend(this,b),this.timeStamp=a&&a.timeStamp||n.now(),void(this[n.expando]=!0)):new n.Event(a,b)},n.Event.prototype={isDefaultPrevented:$,isPropagationStopped:$,isImmediatePropagationStopped:$,preventDefault:function(){var a=this.originalEvent;this.isDefaultPrevented=Z,a&&a.preventDefault&&a.preventDefault()},stopPropagation:function(){var a=this.originalEvent;this.isPropagationStopped=Z,a&&a.stopPropagation&&a.stopPropagation()},stopImmediatePropagation:function(){var a=this.originalEvent;this.isImmediatePropagationStopped=Z,a&&a.stopImmediatePropagation&&a.stopImmediatePropagation(),this.stopPropagation()}},n.each({mouseenter:"mouseover",mouseleave:"mouseout",pointerenter:"pointerover",pointerleave:"pointerout"},function(a,b){n.event.special[a]={delegateType:b,bindType:b,handle:function(a){var c,d=this,e=a.relatedTarget,f=a.handleObj;return(!e||e!==d&&!n.contains(d,e))&&(a.type=f.origType,c=f.handler.apply(this,arguments),a.type=b),c}}}),k.focusinBubbles||n.each({focus:"focusin",blur:"focusout"},function(a,b){var c=function(a){n.event.simulate(b,a.target,n.event.fix(a),!0)};n.event.special[b]={setup:function(){var d=this.ownerDocument||this,e=L.access(d,b);e||d.addEventListener(a,c,!0),L.access(d,b,(e||0)+1)},teardown:function(){var d=this.ownerDocument||this,e=L.access(d,b)-1;e?L.access(d,b,e):(d.removeEventListener(a,c,!0),L.remove(d,b))}}}),n.fn.extend({on:function(a,b,c,d,e){var f,g;if("object"==typeof a){"string"!=typeof b&&(c=c||b,b=void 0);for(g in a)this.on(g,b,c,a[g],e);return this}if(null==c&&null==d?(d=b,c=b=void 0):null==d&&("string"==typeof b?(d=c,c=void 0):(d=c,c=b,b=void 0)),d===!1)d=$;else if(!d)return this;return 1===e&&(f=d,d=function(a){return n().off(a),f.apply(this,arguments)},d.guid=f.guid||(f.guid=n.guid++)),this.each(function(){n.event.add(this,a,d,c,b)})},one:function(a,b,c,d){return this.on(a,b,c,d,1)},off:function(a,b,c){var d,e;if(a&&a.preventDefault&&a.handleObj)return d=a.handleObj,n(a.delegateTarget).off(d.namespace?d.origType+"."+d.namespace:d.origType,d.selector,d.handler),this;if("object"==typeof a){for(e in a)this.off(e,b,a[e]);return this}return(b===!1||"function"==typeof b)&&(c=b,b=void 0),c===!1&&(c=$),this.each(function(){n.event.remove(this,a,c,b)})},trigger:function(a,b){return this.each(function(){n.event.trigger(a,b,this)})},triggerHandler:function(a,b){var c=this[0];return c?n.event.trigger(a,b,c,!0):void 0}});var ab=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,bb=/<([\w:]+)/,cb=/<|&#?\w+;/,db=/<(?:script|style|link)/i,eb=/checked\s*(?:[^=]|=\s*.checked.)/i,fb=/^$|\/(?:java|ecma)script/i,gb=/^true\/(.*)/,hb=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,ib={option:[1,"<select multiple='multiple'>","</select>"],thead:[1,"<table>","</table>"],col:[2,"<table><colgroup>","</colgroup></table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:[0,"",""]};ib.optgroup=ib.option,ib.tbody=ib.tfoot=ib.colgroup=ib.caption=ib.thead,ib.th=ib.td;function jb(a,b){return n.nodeName(a,"table")&&n.nodeName(11!==b.nodeType?b:b.firstChild,"tr")?a.getElementsByTagName("tbody")[0]||a.appendChild(a.ownerDocument.createElement("tbody")):a}function kb(a){return a.type=(null!==a.getAttribute("type"))+"/"+a.type,a}function lb(a){var b=gb.exec(a.type);return b?a.type=b[1]:a.removeAttribute("type"),a}function mb(a,b){for(var c=0,d=a.length;d>c;c++)L.set(a[c],"globalEval",!b||L.get(b[c],"globalEval"))}function nb(a,b){var c,d,e,f,g,h,i,j;if(1===b.nodeType){if(L.hasData(a)&&(f=L.access(a),g=L.set(b,f),j=f.events)){delete g.handle,g.events={};for(e in j)for(c=0,d=j[e].length;d>c;c++)n.event.add(b,e,j[e][c])}M.hasData(a)&&(h=M.access(a),i=n.extend({},h),M.set(b,i))}}function ob(a,b){var c=a.getElementsByTagName?a.getElementsByTagName(b||"*"):a.querySelectorAll?a.querySelectorAll(b||"*"):[];return void 0===b||b&&n.nodeName(a,b)?n.merge([a],c):c}function pb(a,b){var c=b.nodeName.toLowerCase();"input"===c&&T.test(a.type)?b.checked=a.checked:("input"===c||"textarea"===c)&&(b.defaultValue=a.defaultValue)}n.extend({clone:function(a,b,c){var d,e,f,g,h=a.cloneNode(!0),i=n.contains(a.ownerDocument,a);if(!(k.noCloneChecked||1!==a.nodeType&&11!==a.nodeType||n.isXMLDoc(a)))for(g=ob(h),f=ob(a),d=0,e=f.length;e>d;d++)pb(f[d],g[d]);if(b)if(c)for(f=f||ob(a),g=g||ob(h),d=0,e=f.length;e>d;d++)nb(f[d],g[d]);else nb(a,h);return g=ob(h,"script"),g.length>0&&mb(g,!i&&ob(a,"script")),h},buildFragment:function(a,b,c,d){for(var e,f,g,h,i,j,k=b.createDocumentFragment(),l=[],m=0,o=a.length;o>m;m++)if(e=a[m],e||0===e)if("object"===n.type(e))n.merge(l,e.nodeType?[e]:e);else if(cb.test(e)){f=f||k.appendChild(b.createElement("div")),g=(bb.exec(e)||["",""])[1].toLowerCase(),h=ib[g]||ib._default,f.innerHTML=h[1]+e.replace(ab,"<$1></$2>")+h[2],j=h[0];while(j--)f=f.lastChild;n.merge(l,f.childNodes),f=k.firstChild,f.textContent=""}else l.push(b.createTextNode(e));k.textContent="",m=0;while(e=l[m++])if((!d||-1===n.inArray(e,d))&&(i=n.contains(e.ownerDocument,e),f=ob(k.appendChild(e),"script"),i&&mb(f),c)){j=0;while(e=f[j++])fb.test(e.type||"")&&c.push(e)}return k},cleanData:function(a){for(var b,c,d,e,f=n.event.special,g=0;void 0!==(c=a[g]);g++){if(n.acceptData(c)&&(e=c[L.expando],e&&(b=L.cache[e]))){if(b.events)for(d in b.events)f[d]?n.event.remove(c,d):n.removeEvent(c,d,b.handle);L.cache[e]&&delete L.cache[e]}delete M.cache[c[M.expando]]}}}),n.fn.extend({text:function(a){return J(this,function(a){return void 0===a?n.text(this):this.empty().each(function(){(1===this.nodeType||11===this.nodeType||9===this.nodeType)&&(this.textContent=a)})},null,a,arguments.length)},append:function(){return this.domManip(arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=jb(this,a);b.appendChild(a)}})},prepend:function(){return this.domManip(arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=jb(this,a);b.insertBefore(a,b.firstChild)}})},before:function(){return this.domManip(arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this)})},after:function(){return this.domManip(arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this.nextSibling)})},remove:function(a,b){for(var c,d=a?n.filter(a,this):this,e=0;null!=(c=d[e]);e++)b||1!==c.nodeType||n.cleanData(ob(c)),c.parentNode&&(b&&n.contains(c.ownerDocument,c)&&mb(ob(c,"script")),c.parentNode.removeChild(c));return this},empty:function(){for(var a,b=0;null!=(a=this[b]);b++)1===a.nodeType&&(n.cleanData(ob(a,!1)),a.textContent="");return this},clone:function(a,b){return a=null==a?!1:a,b=null==b?a:b,this.map(function(){return n.clone(this,a,b)})},html:function(a){return J(this,function(a){var b=this[0]||{},c=0,d=this.length;if(void 0===a&&1===b.nodeType)return b.innerHTML;if("string"==typeof a&&!db.test(a)&&!ib[(bb.exec(a)||["",""])[1].toLowerCase()]){a=a.replace(ab,"<$1></$2>");try{for(;d>c;c++)b=this[c]||{},1===b.nodeType&&(n.cleanData(ob(b,!1)),b.innerHTML=a);b=0}catch(e){}}b&&this.empty().append(a)},null,a,arguments.length)},replaceWith:function(){var a=arguments[0];return this.domManip(arguments,function(b){a=this.parentNode,n.cleanData(ob(this)),a&&a.replaceChild(b,this)}),a&&(a.length||a.nodeType)?this:this.remove()},detach:function(a){return this.remove(a,!0)},domManip:function(a,b){a=e.apply([],a);var c,d,f,g,h,i,j=0,l=this.length,m=this,o=l-1,p=a[0],q=n.isFunction(p);if(q||l>1&&"string"==typeof p&&!k.checkClone&&eb.test(p))return this.each(function(c){var d=m.eq(c);q&&(a[0]=p.call(this,c,d.html())),d.domManip(a,b)});if(l&&(c=n.buildFragment(a,this[0].ownerDocument,!1,this),d=c.firstChild,1===c.childNodes.length&&(c=d),d)){for(f=n.map(ob(c,"script"),kb),g=f.length;l>j;j++)h=c,j!==o&&(h=n.clone(h,!0,!0),g&&n.merge(f,ob(h,"script"))),b.call(this[j],h,j);if(g)for(i=f[f.length-1].ownerDocument,n.map(f,lb),j=0;g>j;j++)h=f[j],fb.test(h.type||"")&&!L.access(h,"globalEval")&&n.contains(i,h)&&(h.src?n._evalUrl&&n._evalUrl(h.src):n.globalEval(h.textContent.replace(hb,"")))}return this}}),n.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(a,b){n.fn[a]=function(a){for(var c,d=[],e=n(a),g=e.length-1,h=0;g>=h;h++)c=h===g?this:this.clone(!0),n(e[h])[b](c),f.apply(d,c.get());return this.pushStack(d)}});var qb,rb={};function sb(b,c){var d,e=n(c.createElement(b)).appendTo(c.body),f=a.getDefaultComputedStyle&&(d=a.getDefaultComputedStyle(e[0]))?d.display:n.css(e[0],"display");return e.detach(),f}function tb(a){var b=l,c=rb[a];return c||(c=sb(a,b),"none"!==c&&c||(qb=(qb||n("<iframe frameborder='0' width='0' height='0'/>")).appendTo(b.documentElement),b=qb[0].contentDocument,b.write(),b.close(),c=sb(a,b),qb.detach()),rb[a]=c),c}var ub=/^margin/,vb=new RegExp("^("+Q+")(?!px)[a-z%]+$","i"),wb=function(a){return a.ownerDocument.defaultView.getComputedStyle(a,null)};function xb(a,b,c){var d,e,f,g,h=a.style;return c=c||wb(a),c&&(g=c.getPropertyValue(b)||c[b]),c&&(""!==g||n.contains(a.ownerDocument,a)||(g=n.style(a,b)),vb.test(g)&&ub.test(b)&&(d=h.width,e=h.minWidth,f=h.maxWidth,h.minWidth=h.maxWidth=h.width=g,g=c.width,h.width=d,h.minWidth=e,h.maxWidth=f)),void 0!==g?g+"":g}function yb(a,b){return{get:function(){return a()?void delete this.get:(this.get=b).apply(this,arguments)}}}!function(){var b,c,d=l.documentElement,e=l.createElement("div"),f=l.createElement("div");if(f.style){f.style.backgroundClip="content-box",f.cloneNode(!0).style.backgroundClip="",k.clearCloneStyle="content-box"===f.style.backgroundClip,e.style.cssText="border:0;width:0;height:0;top:0;left:-9999px;margin-top:1px;position:absolute",e.appendChild(f);function g(){f.style.cssText="-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;display:block;margin-top:1%;top:1%;border:1px;padding:1px;width:4px;position:absolute",f.innerHTML="",d.appendChild(e);var g=a.getComputedStyle(f,null);b="1%"!==g.top,c="4px"===g.width,d.removeChild(e)}a.getComputedStyle&&n.extend(k,{pixelPosition:function(){return g(),b},boxSizingReliable:function(){return null==c&&g(),c},reliableMarginRight:function(){var b,c=f.appendChild(l.createElement("div"));return c.style.cssText=f.style.cssText="-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;display:block;margin:0;border:0;padding:0",c.style.marginRight=c.style.width="0",f.style.width="1px",d.appendChild(e),b=!parseFloat(a.getComputedStyle(c,null).marginRight),d.removeChild(e),b}})}}(),n.swap=function(a,b,c,d){var e,f,g={};for(f in b)g[f]=a.style[f],a.style[f]=b[f];e=c.apply(a,d||[]);for(f in b)a.style[f]=g[f];return e};var zb=/^(none|table(?!-c[ea]).+)/,Ab=new RegExp("^("+Q+")(.*)$","i"),Bb=new RegExp("^([+-])=("+Q+")","i"),Cb={position:"absolute",visibility:"hidden",display:"block"},Db={letterSpacing:"0",fontWeight:"400"},Eb=["Webkit","O","Moz","ms"];function Fb(a,b){if(b in a)return b;var c=b[0].toUpperCase()+b.slice(1),d=b,e=Eb.length;while(e--)if(b=Eb[e]+c,b in a)return b;return d}function Gb(a,b,c){var d=Ab.exec(b);return d?Math.max(0,d[1]-(c||0))+(d[2]||"px"):b}function Hb(a,b,c,d,e){for(var f=c===(d?"border":"content")?4:"width"===b?1:0,g=0;4>f;f+=2)"margin"===c&&(g+=n.css(a,c+R[f],!0,e)),d?("content"===c&&(g-=n.css(a,"padding"+R[f],!0,e)),"margin"!==c&&(g-=n.css(a,"border"+R[f]+"Width",!0,e))):(g+=n.css(a,"padding"+R[f],!0,e),"padding"!==c&&(g+=n.css(a,"border"+R[f]+"Width",!0,e)));return g}function Ib(a,b,c){var d=!0,e="width"===b?a.offsetWidth:a.offsetHeight,f=wb(a),g="border-box"===n.css(a,"boxSizing",!1,f);if(0>=e||null==e){if(e=xb(a,b,f),(0>e||null==e)&&(e=a.style[b]),vb.test(e))return e;d=g&&(k.boxSizingReliable()||e===a.style[b]),e=parseFloat(e)||0}return e+Hb(a,b,c||(g?"border":"content"),d,f)+"px"}function Jb(a,b){for(var c,d,e,f=[],g=0,h=a.length;h>g;g++)d=a[g],d.style&&(f[g]=L.get(d,"olddisplay"),c=d.style.display,b?(f[g]||"none"!==c||(d.style.display=""),""===d.style.display&&S(d)&&(f[g]=L.access(d,"olddisplay",tb(d.nodeName)))):(e=S(d),"none"===c&&e||L.set(d,"olddisplay",e?c:n.css(d,"display"))));for(g=0;h>g;g++)d=a[g],d.style&&(b&&"none"!==d.style.display&&""!==d.style.display||(d.style.display=b?f[g]||"":"none"));return a}n.extend({cssHooks:{opacity:{get:function(a,b){if(b){var c=xb(a,"opacity");return""===c?"1":c}}}},cssNumber:{columnCount:!0,fillOpacity:!0,flexGrow:!0,flexShrink:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":"cssFloat"},style:function(a,b,c,d){if(a&&3!==a.nodeType&&8!==a.nodeType&&a.style){var e,f,g,h=n.camelCase(b),i=a.style;return b=n.cssProps[h]||(n.cssProps[h]=Fb(i,h)),g=n.cssHooks[b]||n.cssHooks[h],void 0===c?g&&"get"in g&&void 0!==(e=g.get(a,!1,d))?e:i[b]:(f=typeof c,"string"===f&&(e=Bb.exec(c))&&(c=(e[1]+1)*e[2]+parseFloat(n.css(a,b)),f="number"),null!=c&&c===c&&("number"!==f||n.cssNumber[h]||(c+="px"),k.clearCloneStyle||""!==c||0!==b.indexOf("background")||(i[b]="inherit"),g&&"set"in g&&void 0===(c=g.set(a,c,d))||(i[b]=c)),void 0)}},css:function(a,b,c,d){var e,f,g,h=n.camelCase(b);return b=n.cssProps[h]||(n.cssProps[h]=Fb(a.style,h)),g=n.cssHooks[b]||n.cssHooks[h],g&&"get"in g&&(e=g.get(a,!0,c)),void 0===e&&(e=xb(a,b,d)),"normal"===e&&b in Db&&(e=Db[b]),""===c||c?(f=parseFloat(e),c===!0||n.isNumeric(f)?f||0:e):e}}),n.each(["height","width"],function(a,b){n.cssHooks[b]={get:function(a,c,d){return c?zb.test(n.css(a,"display"))&&0===a.offsetWidth?n.swap(a,Cb,function(){return Ib(a,b,d)}):Ib(a,b,d):void 0},set:function(a,c,d){var e=d&&wb(a);return Gb(a,c,d?Hb(a,b,d,"border-box"===n.css(a,"boxSizing",!1,e),e):0)}}}),n.cssHooks.marginRight=yb(k.reliableMarginRight,function(a,b){return b?n.swap(a,{display:"inline-block"},xb,[a,"marginRight"]):void 0}),n.each({margin:"",padding:"",border:"Width"},function(a,b){n.cssHooks[a+b]={expand:function(c){for(var d=0,e={},f="string"==typeof c?c.split(" "):[c];4>d;d++)e[a+R[d]+b]=f[d]||f[d-2]||f[0];return e}},ub.test(a)||(n.cssHooks[a+b].set=Gb)}),n.fn.extend({css:function(a,b){return J(this,function(a,b,c){var d,e,f={},g=0;if(n.isArray(b)){for(d=wb(a),e=b.length;e>g;g++)f[b[g]]=n.css(a,b[g],!1,d);return f}return void 0!==c?n.style(a,b,c):n.css(a,b)},a,b,arguments.length>1)},show:function(){return Jb(this,!0)},hide:function(){return Jb(this)},toggle:function(a){return"boolean"==typeof a?a?this.show():this.hide():this.each(function(){S(this)?n(this).show():n(this).hide()})}});function Kb(a,b,c,d,e){return new Kb.prototype.init(a,b,c,d,e)}n.Tween=Kb,Kb.prototype={constructor:Kb,init:function(a,b,c,d,e,f){this.elem=a,this.prop=c,this.easing=e||"swing",this.options=b,this.start=this.now=this.cur(),this.end=d,this.unit=f||(n.cssNumber[c]?"":"px")},cur:function(){var a=Kb.propHooks[this.prop];return a&&a.get?a.get(this):Kb.propHooks._default.get(this)},run:function(a){var b,c=Kb.propHooks[this.prop];return this.pos=b=this.options.duration?n.easing[this.easing](a,this.options.duration*a,0,1,this.options.duration):a,this.now=(this.end-this.start)*b+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),c&&c.set?c.set(this):Kb.propHooks._default.set(this),this}},Kb.prototype.init.prototype=Kb.prototype,Kb.propHooks={_default:{get:function(a){var b;return null==a.elem[a.prop]||a.elem.style&&null!=a.elem.style[a.prop]?(b=n.css(a.elem,a.prop,""),b&&"auto"!==b?b:0):a.elem[a.prop]},set:function(a){n.fx.step[a.prop]?n.fx.step[a.prop](a):a.elem.style&&(null!=a.elem.style[n.cssProps[a.prop]]||n.cssHooks[a.prop])?n.style(a.elem,a.prop,a.now+a.unit):a.elem[a.prop]=a.now}}},Kb.propHooks.scrollTop=Kb.propHooks.scrollLeft={set:function(a){a.elem.nodeType&&a.elem.parentNode&&(a.elem[a.prop]=a.now)}},n.easing={linear:function(a){return a},swing:function(a){return.5-Math.cos(a*Math.PI)/2}},n.fx=Kb.prototype.init,n.fx.step={};var Lb,Mb,Nb=/^(?:toggle|show|hide)$/,Ob=new RegExp("^(?:([+-])=|)("+Q+")([a-z%]*)$","i"),Pb=/queueHooks$/,Qb=[Vb],Rb={"*":[function(a,b){var c=this.createTween(a,b),d=c.cur(),e=Ob.exec(b),f=e&&e[3]||(n.cssNumber[a]?"":"px"),g=(n.cssNumber[a]||"px"!==f&&+d)&&Ob.exec(n.css(c.elem,a)),h=1,i=20;if(g&&g[3]!==f){f=f||g[3],e=e||[],g=+d||1;do h=h||".5",g/=h,n.style(c.elem,a,g+f);while(h!==(h=c.cur()/d)&&1!==h&&--i)}return e&&(g=c.start=+g||+d||0,c.unit=f,c.end=e[1]?g+(e[1]+1)*e[2]:+e[2]),c}]};function Sb(){return setTimeout(function(){Lb=void 0}),Lb=n.now()}function Tb(a,b){var c,d=0,e={height:a};for(b=b?1:0;4>d;d+=2-b)c=R[d],e["margin"+c]=e["padding"+c]=a;return b&&(e.opacity=e.width=a),e}function Ub(a,b,c){for(var d,e=(Rb[b]||[]).concat(Rb["*"]),f=0,g=e.length;g>f;f++)if(d=e[f].call(c,b,a))return d}function Vb(a,b,c){var d,e,f,g,h,i,j,k,l=this,m={},o=a.style,p=a.nodeType&&S(a),q=L.get(a,"fxshow");c.queue||(h=n._queueHooks(a,"fx"),null==h.unqueued&&(h.unqueued=0,i=h.empty.fire,h.empty.fire=function(){h.unqueued||i()}),h.unqueued++,l.always(function(){l.always(function(){h.unqueued--,n.queue(a,"fx").length||h.empty.fire()})})),1===a.nodeType&&("height"in b||"width"in b)&&(c.overflow=[o.overflow,o.overflowX,o.overflowY],j=n.css(a,"display"),k="none"===j?L.get(a,"olddisplay")||tb(a.nodeName):j,"inline"===k&&"none"===n.css(a,"float")&&(o.display="inline-block")),c.overflow&&(o.overflow="hidden",l.always(function(){o.overflow=c.overflow[0],o.overflowX=c.overflow[1],o.overflowY=c.overflow[2]}));for(d in b)if(e=b[d],Nb.exec(e)){if(delete b[d],f=f||"toggle"===e,e===(p?"hide":"show")){if("show"!==e||!q||void 0===q[d])continue;p=!0}m[d]=q&&q[d]||n.style(a,d)}else j=void 0;if(n.isEmptyObject(m))"inline"===("none"===j?tb(a.nodeName):j)&&(o.display=j);else{q?"hidden"in q&&(p=q.hidden):q=L.access(a,"fxshow",{}),f&&(q.hidden=!p),p?n(a).show():l.done(function(){n(a).hide()}),l.done(function(){var b;L.remove(a,"fxshow");for(b in m)n.style(a,b,m[b])});for(d in m)g=Ub(p?q[d]:0,d,l),d in q||(q[d]=g.start,p&&(g.end=g.start,g.start="width"===d||"height"===d?1:0))}}function Wb(a,b){var c,d,e,f,g;for(c in a)if(d=n.camelCase(c),e=b[d],f=a[c],n.isArray(f)&&(e=f[1],f=a[c]=f[0]),c!==d&&(a[d]=f,delete a[c]),g=n.cssHooks[d],g&&"expand"in g){f=g.expand(f),delete a[d];for(c in f)c in a||(a[c]=f[c],b[c]=e)}else b[d]=e}function Xb(a,b,c){var d,e,f=0,g=Qb.length,h=n.Deferred().always(function(){delete i.elem}),i=function(){if(e)return!1;for(var b=Lb||Sb(),c=Math.max(0,j.startTime+j.duration-b),d=c/j.duration||0,f=1-d,g=0,i=j.tweens.length;i>g;g++)j.tweens[g].run(f);return h.notifyWith(a,[j,f,c]),1>f&&i?c:(h.resolveWith(a,[j]),!1)},j=h.promise({elem:a,props:n.extend({},b),opts:n.extend(!0,{specialEasing:{}},c),originalProperties:b,originalOptions:c,startTime:Lb||Sb(),duration:c.duration,tweens:[],createTween:function(b,c){var d=n.Tween(a,j.opts,b,c,j.opts.specialEasing[b]||j.opts.easing);return j.tweens.push(d),d},stop:function(b){var c=0,d=b?j.tweens.length:0;if(e)return this;for(e=!0;d>c;c++)j.tweens[c].run(1);return b?h.resolveWith(a,[j,b]):h.rejectWith(a,[j,b]),this}}),k=j.props;for(Wb(k,j.opts.specialEasing);g>f;f++)if(d=Qb[f].call(j,a,k,j.opts))return d;return n.map(k,Ub,j),n.isFunction(j.opts.start)&&j.opts.start.call(a,j),n.fx.timer(n.extend(i,{elem:a,anim:j,queue:j.opts.queue})),j.progress(j.opts.progress).done(j.opts.done,j.opts.complete).fail(j.opts.fail).always(j.opts.always)}n.Animation=n.extend(Xb,{tweener:function(a,b){n.isFunction(a)?(b=a,a=["*"]):a=a.split(" ");for(var c,d=0,e=a.length;e>d;d++)c=a[d],Rb[c]=Rb[c]||[],Rb[c].unshift(b)},prefilter:function(a,b){b?Qb.unshift(a):Qb.push(a)}}),n.speed=function(a,b,c){var d=a&&"object"==typeof a?n.extend({},a):{complete:c||!c&&b||n.isFunction(a)&&a,duration:a,easing:c&&b||b&&!n.isFunction(b)&&b};return d.duration=n.fx.off?0:"number"==typeof d.duration?d.duration:d.duration in n.fx.speeds?n.fx.speeds[d.duration]:n.fx.speeds._default,(null==d.queue||d.queue===!0)&&(d.queue="fx"),d.old=d.complete,d.complete=function(){n.isFunction(d.old)&&d.old.call(this),d.queue&&n.dequeue(this,d.queue)},d},n.fn.extend({fadeTo:function(a,b,c,d){return this.filter(S).css("opacity",0).show().end().animate({opacity:b},a,c,d)},animate:function(a,b,c,d){var e=n.isEmptyObject(a),f=n.speed(b,c,d),g=function(){var b=Xb(this,n.extend({},a),f);(e||L.get(this,"finish"))&&b.stop(!0)};return g.finish=g,e||f.queue===!1?this.each(g):this.queue(f.queue,g)},stop:function(a,b,c){var d=function(a){var b=a.stop;delete a.stop,b(c)};return"string"!=typeof a&&(c=b,b=a,a=void 0),b&&a!==!1&&this.queue(a||"fx",[]),this.each(function(){var b=!0,e=null!=a&&a+"queueHooks",f=n.timers,g=L.get(this);if(e)g[e]&&g[e].stop&&d(g[e]);else for(e in g)g[e]&&g[e].stop&&Pb.test(e)&&d(g[e]);for(e=f.length;e--;)f[e].elem!==this||null!=a&&f[e].queue!==a||(f[e].anim.stop(c),b=!1,f.splice(e,1));(b||!c)&&n.dequeue(this,a)})},finish:function(a){return a!==!1&&(a=a||"fx"),this.each(function(){var b,c=L.get(this),d=c[a+"queue"],e=c[a+"queueHooks"],f=n.timers,g=d?d.length:0;for(c.finish=!0,n.queue(this,a,[]),e&&e.stop&&e.stop.call(this,!0),b=f.length;b--;)f[b].elem===this&&f[b].queue===a&&(f[b].anim.stop(!0),f.splice(b,1));for(b=0;g>b;b++)d[b]&&d[b].finish&&d[b].finish.call(this);delete c.finish})}}),n.each(["toggle","show","hide"],function(a,b){var c=n.fn[b];n.fn[b]=function(a,d,e){return null==a||"boolean"==typeof a?c.apply(this,arguments):this.animate(Tb(b,!0),a,d,e)}}),n.each({slideDown:Tb("show"),slideUp:Tb("hide"),slideToggle:Tb("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(a,b){n.fn[a]=function(a,c,d){return this.animate(b,a,c,d)}}),n.timers=[],n.fx.tick=function(){var a,b=0,c=n.timers;for(Lb=n.now();b<c.length;b++)a=c[b],a()||c[b]!==a||c.splice(b--,1);c.length||n.fx.stop(),Lb=void 0},n.fx.timer=function(a){n.timers.push(a),a()?n.fx.start():n.timers.pop()},n.fx.interval=13,n.fx.start=function(){Mb||(Mb=setInterval(n.fx.tick,n.fx.interval))},n.fx.stop=function(){clearInterval(Mb),Mb=null},n.fx.speeds={slow:600,fast:200,_default:400},n.fn.delay=function(a,b){return a=n.fx?n.fx.speeds[a]||a:a,b=b||"fx",this.queue(b,function(b,c){var d=setTimeout(b,a);c.stop=function(){clearTimeout(d)}})},function(){var a=l.createElement("input"),b=l.createElement("select"),c=b.appendChild(l.createElement("option"));a.type="checkbox",k.checkOn=""!==a.value,k.optSelected=c.selected,b.disabled=!0,k.optDisabled=!c.disabled,a=l.createElement("input"),a.value="t",a.type="radio",k.radioValue="t"===a.value}();var Yb,Zb,$b=n.expr.attrHandle;n.fn.extend({attr:function(a,b){return J(this,n.attr,a,b,arguments.length>1)},removeAttr:function(a){return this.each(function(){n.removeAttr(this,a)})}}),n.extend({attr:function(a,b,c){var d,e,f=a.nodeType;if(a&&3!==f&&8!==f&&2!==f)return typeof a.getAttribute===U?n.prop(a,b,c):(1===f&&n.isXMLDoc(a)||(b=b.toLowerCase(),d=n.attrHooks[b]||(n.expr.match.bool.test(b)?Zb:Yb)),void 0===c?d&&"get"in d&&null!==(e=d.get(a,b))?e:(e=n.find.attr(a,b),null==e?void 0:e):null!==c?d&&"set"in d&&void 0!==(e=d.set(a,c,b))?e:(a.setAttribute(b,c+""),c):void n.removeAttr(a,b))
},removeAttr:function(a,b){var c,d,e=0,f=b&&b.match(E);if(f&&1===a.nodeType)while(c=f[e++])d=n.propFix[c]||c,n.expr.match.bool.test(c)&&(a[d]=!1),a.removeAttribute(c)},attrHooks:{type:{set:function(a,b){if(!k.radioValue&&"radio"===b&&n.nodeName(a,"input")){var c=a.value;return a.setAttribute("type",b),c&&(a.value=c),b}}}}}),Zb={set:function(a,b,c){return b===!1?n.removeAttr(a,c):a.setAttribute(c,c),c}},n.each(n.expr.match.bool.source.match(/\w+/g),function(a,b){var c=$b[b]||n.find.attr;$b[b]=function(a,b,d){var e,f;return d||(f=$b[b],$b[b]=e,e=null!=c(a,b,d)?b.toLowerCase():null,$b[b]=f),e}});var _b=/^(?:input|select|textarea|button)$/i;n.fn.extend({prop:function(a,b){return J(this,n.prop,a,b,arguments.length>1)},removeProp:function(a){return this.each(function(){delete this[n.propFix[a]||a]})}}),n.extend({propFix:{"for":"htmlFor","class":"className"},prop:function(a,b,c){var d,e,f,g=a.nodeType;if(a&&3!==g&&8!==g&&2!==g)return f=1!==g||!n.isXMLDoc(a),f&&(b=n.propFix[b]||b,e=n.propHooks[b]),void 0!==c?e&&"set"in e&&void 0!==(d=e.set(a,c,b))?d:a[b]=c:e&&"get"in e&&null!==(d=e.get(a,b))?d:a[b]},propHooks:{tabIndex:{get:function(a){return a.hasAttribute("tabindex")||_b.test(a.nodeName)||a.href?a.tabIndex:-1}}}}),k.optSelected||(n.propHooks.selected={get:function(a){var b=a.parentNode;return b&&b.parentNode&&b.parentNode.selectedIndex,null}}),n.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){n.propFix[this.toLowerCase()]=this});var ac=/[\t\r\n\f]/g;n.fn.extend({addClass:function(a){var b,c,d,e,f,g,h="string"==typeof a&&a,i=0,j=this.length;if(n.isFunction(a))return this.each(function(b){n(this).addClass(a.call(this,b,this.className))});if(h)for(b=(a||"").match(E)||[];j>i;i++)if(c=this[i],d=1===c.nodeType&&(c.className?(" "+c.className+" ").replace(ac," "):" ")){f=0;while(e=b[f++])d.indexOf(" "+e+" ")<0&&(d+=e+" ");g=n.trim(d),c.className!==g&&(c.className=g)}return this},removeClass:function(a){var b,c,d,e,f,g,h=0===arguments.length||"string"==typeof a&&a,i=0,j=this.length;if(n.isFunction(a))return this.each(function(b){n(this).removeClass(a.call(this,b,this.className))});if(h)for(b=(a||"").match(E)||[];j>i;i++)if(c=this[i],d=1===c.nodeType&&(c.className?(" "+c.className+" ").replace(ac," "):"")){f=0;while(e=b[f++])while(d.indexOf(" "+e+" ")>=0)d=d.replace(" "+e+" "," ");g=a?n.trim(d):"",c.className!==g&&(c.className=g)}return this},toggleClass:function(a,b){var c=typeof a;return"boolean"==typeof b&&"string"===c?b?this.addClass(a):this.removeClass(a):this.each(n.isFunction(a)?function(c){n(this).toggleClass(a.call(this,c,this.className,b),b)}:function(){if("string"===c){var b,d=0,e=n(this),f=a.match(E)||[];while(b=f[d++])e.hasClass(b)?e.removeClass(b):e.addClass(b)}else(c===U||"boolean"===c)&&(this.className&&L.set(this,"__className__",this.className),this.className=this.className||a===!1?"":L.get(this,"__className__")||"")})},hasClass:function(a){for(var b=" "+a+" ",c=0,d=this.length;d>c;c++)if(1===this[c].nodeType&&(" "+this[c].className+" ").replace(ac," ").indexOf(b)>=0)return!0;return!1}});var bc=/\r/g;n.fn.extend({val:function(a){var b,c,d,e=this[0];{if(arguments.length)return d=n.isFunction(a),this.each(function(c){var e;1===this.nodeType&&(e=d?a.call(this,c,n(this).val()):a,null==e?e="":"number"==typeof e?e+="":n.isArray(e)&&(e=n.map(e,function(a){return null==a?"":a+""})),b=n.valHooks[this.type]||n.valHooks[this.nodeName.toLowerCase()],b&&"set"in b&&void 0!==b.set(this,e,"value")||(this.value=e))});if(e)return b=n.valHooks[e.type]||n.valHooks[e.nodeName.toLowerCase()],b&&"get"in b&&void 0!==(c=b.get(e,"value"))?c:(c=e.value,"string"==typeof c?c.replace(bc,""):null==c?"":c)}}}),n.extend({valHooks:{option:{get:function(a){var b=n.find.attr(a,"value");return null!=b?b:n.trim(n.text(a))}},select:{get:function(a){for(var b,c,d=a.options,e=a.selectedIndex,f="select-one"===a.type||0>e,g=f?null:[],h=f?e+1:d.length,i=0>e?h:f?e:0;h>i;i++)if(c=d[i],!(!c.selected&&i!==e||(k.optDisabled?c.disabled:null!==c.getAttribute("disabled"))||c.parentNode.disabled&&n.nodeName(c.parentNode,"optgroup"))){if(b=n(c).val(),f)return b;g.push(b)}return g},set:function(a,b){var c,d,e=a.options,f=n.makeArray(b),g=e.length;while(g--)d=e[g],(d.selected=n.inArray(d.value,f)>=0)&&(c=!0);return c||(a.selectedIndex=-1),f}}}}),n.each(["radio","checkbox"],function(){n.valHooks[this]={set:function(a,b){return n.isArray(b)?a.checked=n.inArray(n(a).val(),b)>=0:void 0}},k.checkOn||(n.valHooks[this].get=function(a){return null===a.getAttribute("value")?"on":a.value})}),n.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(a,b){n.fn[b]=function(a,c){return arguments.length>0?this.on(b,null,a,c):this.trigger(b)}}),n.fn.extend({hover:function(a,b){return this.mouseenter(a).mouseleave(b||a)},bind:function(a,b,c){return this.on(a,null,b,c)},unbind:function(a,b){return this.off(a,null,b)},delegate:function(a,b,c,d){return this.on(b,a,c,d)},undelegate:function(a,b,c){return 1===arguments.length?this.off(a,"**"):this.off(b,a||"**",c)}});var cc=n.now(),dc=/\?/;n.parseJSON=function(a){return JSON.parse(a+"")},n.parseXML=function(a){var b,c;if(!a||"string"!=typeof a)return null;try{c=new DOMParser,b=c.parseFromString(a,"text/xml")}catch(d){b=void 0}return(!b||b.getElementsByTagName("parsererror").length)&&n.error("Invalid XML: "+a),b};var ec,fc,gc=/#.*$/,hc=/([?&])_=[^&]*/,ic=/^(.*?):[ \t]*([^\r\n]*)$/gm,jc=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,kc=/^(?:GET|HEAD)$/,lc=/^\/\//,mc=/^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,nc={},oc={},pc="*/".concat("*");try{fc=location.href}catch(qc){fc=l.createElement("a"),fc.href="",fc=fc.href}ec=mc.exec(fc.toLowerCase())||[];function rc(a){return function(b,c){"string"!=typeof b&&(c=b,b="*");var d,e=0,f=b.toLowerCase().match(E)||[];if(n.isFunction(c))while(d=f[e++])"+"===d[0]?(d=d.slice(1)||"*",(a[d]=a[d]||[]).unshift(c)):(a[d]=a[d]||[]).push(c)}}function sc(a,b,c,d){var e={},f=a===oc;function g(h){var i;return e[h]=!0,n.each(a[h]||[],function(a,h){var j=h(b,c,d);return"string"!=typeof j||f||e[j]?f?!(i=j):void 0:(b.dataTypes.unshift(j),g(j),!1)}),i}return g(b.dataTypes[0])||!e["*"]&&g("*")}function tc(a,b){var c,d,e=n.ajaxSettings.flatOptions||{};for(c in b)void 0!==b[c]&&((e[c]?a:d||(d={}))[c]=b[c]);return d&&n.extend(!0,a,d),a}function uc(a,b,c){var d,e,f,g,h=a.contents,i=a.dataTypes;while("*"===i[0])i.shift(),void 0===d&&(d=a.mimeType||b.getResponseHeader("Content-Type"));if(d)for(e in h)if(h[e]&&h[e].test(d)){i.unshift(e);break}if(i[0]in c)f=i[0];else{for(e in c){if(!i[0]||a.converters[e+" "+i[0]]){f=e;break}g||(g=e)}f=f||g}return f?(f!==i[0]&&i.unshift(f),c[f]):void 0}function vc(a,b,c,d){var e,f,g,h,i,j={},k=a.dataTypes.slice();if(k[1])for(g in a.converters)j[g.toLowerCase()]=a.converters[g];f=k.shift();while(f)if(a.responseFields[f]&&(c[a.responseFields[f]]=b),!i&&d&&a.dataFilter&&(b=a.dataFilter(b,a.dataType)),i=f,f=k.shift())if("*"===f)f=i;else if("*"!==i&&i!==f){if(g=j[i+" "+f]||j["* "+f],!g)for(e in j)if(h=e.split(" "),h[1]===f&&(g=j[i+" "+h[0]]||j["* "+h[0]])){g===!0?g=j[e]:j[e]!==!0&&(f=h[0],k.unshift(h[1]));break}if(g!==!0)if(g&&a["throws"])b=g(b);else try{b=g(b)}catch(l){return{state:"parsererror",error:g?l:"No conversion from "+i+" to "+f}}}return{state:"success",data:b}}n.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:fc,type:"GET",isLocal:jc.test(ec[1]),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":pc,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":n.parseJSON,"text xml":n.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(a,b){return b?tc(tc(a,n.ajaxSettings),b):tc(n.ajaxSettings,a)},ajaxPrefilter:rc(nc),ajaxTransport:rc(oc),ajax:function(a,b){"object"==typeof a&&(b=a,a=void 0),b=b||{};var c,d,e,f,g,h,i,j,k=n.ajaxSetup({},b),l=k.context||k,m=k.context&&(l.nodeType||l.jquery)?n(l):n.event,o=n.Deferred(),p=n.Callbacks("once memory"),q=k.statusCode||{},r={},s={},t=0,u="canceled",v={readyState:0,getResponseHeader:function(a){var b;if(2===t){if(!f){f={};while(b=ic.exec(e))f[b[1].toLowerCase()]=b[2]}b=f[a.toLowerCase()]}return null==b?null:b},getAllResponseHeaders:function(){return 2===t?e:null},setRequestHeader:function(a,b){var c=a.toLowerCase();return t||(a=s[c]=s[c]||a,r[a]=b),this},overrideMimeType:function(a){return t||(k.mimeType=a),this},statusCode:function(a){var b;if(a)if(2>t)for(b in a)q[b]=[q[b],a[b]];else v.always(a[v.status]);return this},abort:function(a){var b=a||u;return c&&c.abort(b),x(0,b),this}};if(o.promise(v).complete=p.add,v.success=v.done,v.error=v.fail,k.url=((a||k.url||fc)+"").replace(gc,"").replace(lc,ec[1]+"//"),k.type=b.method||b.type||k.method||k.type,k.dataTypes=n.trim(k.dataType||"*").toLowerCase().match(E)||[""],null==k.crossDomain&&(h=mc.exec(k.url.toLowerCase()),k.crossDomain=!(!h||h[1]===ec[1]&&h[2]===ec[2]&&(h[3]||("http:"===h[1]?"80":"443"))===(ec[3]||("http:"===ec[1]?"80":"443")))),k.data&&k.processData&&"string"!=typeof k.data&&(k.data=n.param(k.data,k.traditional)),sc(nc,k,b,v),2===t)return v;i=k.global,i&&0===n.active++&&n.event.trigger("ajaxStart"),k.type=k.type.toUpperCase(),k.hasContent=!kc.test(k.type),d=k.url,k.hasContent||(k.data&&(d=k.url+=(dc.test(d)?"&":"?")+k.data,delete k.data),k.cache===!1&&(k.url=hc.test(d)?d.replace(hc,"$1_="+cc++):d+(dc.test(d)?"&":"?")+"_="+cc++)),k.ifModified&&(n.lastModified[d]&&v.setRequestHeader("If-Modified-Since",n.lastModified[d]),n.etag[d]&&v.setRequestHeader("If-None-Match",n.etag[d])),(k.data&&k.hasContent&&k.contentType!==!1||b.contentType)&&v.setRequestHeader("Content-Type",k.contentType),v.setRequestHeader("Accept",k.dataTypes[0]&&k.accepts[k.dataTypes[0]]?k.accepts[k.dataTypes[0]]+("*"!==k.dataTypes[0]?", "+pc+"; q=0.01":""):k.accepts["*"]);for(j in k.headers)v.setRequestHeader(j,k.headers[j]);if(k.beforeSend&&(k.beforeSend.call(l,v,k)===!1||2===t))return v.abort();u="abort";for(j in{success:1,error:1,complete:1})v[j](k[j]);if(c=sc(oc,k,b,v)){v.readyState=1,i&&m.trigger("ajaxSend",[v,k]),k.async&&k.timeout>0&&(g=setTimeout(function(){v.abort("timeout")},k.timeout));try{t=1,c.send(r,x)}catch(w){if(!(2>t))throw w;x(-1,w)}}else x(-1,"No Transport");function x(a,b,f,h){var j,r,s,u,w,x=b;2!==t&&(t=2,g&&clearTimeout(g),c=void 0,e=h||"",v.readyState=a>0?4:0,j=a>=200&&300>a||304===a,f&&(u=uc(k,v,f)),u=vc(k,u,v,j),j?(k.ifModified&&(w=v.getResponseHeader("Last-Modified"),w&&(n.lastModified[d]=w),w=v.getResponseHeader("etag"),w&&(n.etag[d]=w)),204===a||"HEAD"===k.type?x="nocontent":304===a?x="notmodified":(x=u.state,r=u.data,s=u.error,j=!s)):(s=x,(a||!x)&&(x="error",0>a&&(a=0))),v.status=a,v.statusText=(b||x)+"",j?o.resolveWith(l,[r,x,v]):o.rejectWith(l,[v,x,s]),v.statusCode(q),q=void 0,i&&m.trigger(j?"ajaxSuccess":"ajaxError",[v,k,j?r:s]),p.fireWith(l,[v,x]),i&&(m.trigger("ajaxComplete",[v,k]),--n.active||n.event.trigger("ajaxStop")))}return v},getJSON:function(a,b,c){return n.get(a,b,c,"json")},getScript:function(a,b){return n.get(a,void 0,b,"script")}}),n.each(["get","post"],function(a,b){n[b]=function(a,c,d,e){return n.isFunction(c)&&(e=e||d,d=c,c=void 0),n.ajax({url:a,type:b,dataType:e,data:c,success:d})}}),n.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(a,b){n.fn[b]=function(a){return this.on(b,a)}}),n._evalUrl=function(a){return n.ajax({url:a,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0})},n.expr.filters.hidden=function(a){return a.offsetWidth<=0&&a.offsetHeight<=0},n.expr.filters.visible=function(a){return!n.expr.filters.hidden(a)};var wc=/%20/g,xc=/\[\]$/,yc=/\r?\n/g,zc=/^(?:submit|button|image|reset|file)$/i,Ac=/^(?:input|select|textarea|keygen)/i;function Bc(a,b,c,d){var e;if(n.isArray(b))n.each(b,function(b,e){c||xc.test(a)?d(a,e):Bc(a+"["+("object"==typeof e?b:"")+"]",e,c,d)});else if(c||"object"!==n.type(b))d(a,b);else for(e in b)Bc(a+"["+e+"]",b[e],c,d)}n.param=function(a,b){var c,d=[],e=function(a,b){b=n.isFunction(b)?b():null==b?"":b,d[d.length]=encodeURIComponent(a)+"="+encodeURIComponent(b)};if(void 0===b&&(b=n.ajaxSettings&&n.ajaxSettings.traditional),n.isArray(a)||a.jquery&&!n.isPlainObject(a))n.each(a,function(){e(this.name,this.value)});else for(c in a)Bc(c,a[c],b,e);return d.join("&").replace(wc,"+")},n.fn.extend({serialize:function(){return n.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var a=n.prop(this,"elements");return a?n.makeArray(a):this}).filter(function(){var a=this.type;return this.name&&!n(this).is(":disabled")&&Ac.test(this.nodeName)&&!zc.test(a)&&(this.checked||!T.test(a))}).map(function(a,b){var c=n(this).val();return null==c?null:n.isArray(c)?n.map(c,function(a){return{name:b.name,value:a.replace(yc,"\r\n")}}):{name:b.name,value:c.replace(yc,"\r\n")}}).get()}}),n.ajaxSettings.xhr=function(){try{return new XMLHttpRequest}catch(a){}};var Cc=0,Dc={},Ec={0:200,1223:204},Fc=n.ajaxSettings.xhr();a.ActiveXObject&&n(a).on("unload",function(){for(var a in Dc)Dc[a]()}),k.cors=!!Fc&&"withCredentials"in Fc,k.ajax=Fc=!!Fc,n.ajaxTransport(function(a){var b;return k.cors||Fc&&!a.crossDomain?{send:function(c,d){var e,f=a.xhr(),g=++Cc;if(f.open(a.type,a.url,a.async,a.username,a.password),a.xhrFields)for(e in a.xhrFields)f[e]=a.xhrFields[e];a.mimeType&&f.overrideMimeType&&f.overrideMimeType(a.mimeType),a.crossDomain||c["X-Requested-With"]||(c["X-Requested-With"]="XMLHttpRequest");for(e in c)f.setRequestHeader(e,c[e]);b=function(a){return function(){b&&(delete Dc[g],b=f.onload=f.onerror=null,"abort"===a?f.abort():"error"===a?d(f.status,f.statusText):d(Ec[f.status]||f.status,f.statusText,"string"==typeof f.responseText?{text:f.responseText}:void 0,f.getAllResponseHeaders()))}},f.onload=b(),f.onerror=b("error"),b=Dc[g]=b("abort");try{f.send(a.hasContent&&a.data||null)}catch(h){if(b)throw h}},abort:function(){b&&b()}}:void 0}),n.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/(?:java|ecma)script/},converters:{"text script":function(a){return n.globalEval(a),a}}}),n.ajaxPrefilter("script",function(a){void 0===a.cache&&(a.cache=!1),a.crossDomain&&(a.type="GET")}),n.ajaxTransport("script",function(a){if(a.crossDomain){var b,c;return{send:function(d,e){b=n("<script>").prop({async:!0,charset:a.scriptCharset,src:a.url}).on("load error",c=function(a){b.remove(),c=null,a&&e("error"===a.type?404:200,a.type)}),l.head.appendChild(b[0])},abort:function(){c&&c()}}}});var Gc=[],Hc=/(=)\?(?=&|$)|\?\?/;n.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var a=Gc.pop()||n.expando+"_"+cc++;return this[a]=!0,a}}),n.ajaxPrefilter("json jsonp",function(b,c,d){var e,f,g,h=b.jsonp!==!1&&(Hc.test(b.url)?"url":"string"==typeof b.data&&!(b.contentType||"").indexOf("application/x-www-form-urlencoded")&&Hc.test(b.data)&&"data");return h||"jsonp"===b.dataTypes[0]?(e=b.jsonpCallback=n.isFunction(b.jsonpCallback)?b.jsonpCallback():b.jsonpCallback,h?b[h]=b[h].replace(Hc,"$1"+e):b.jsonp!==!1&&(b.url+=(dc.test(b.url)?"&":"?")+b.jsonp+"="+e),b.converters["script json"]=function(){return g||n.error(e+" was not called"),g[0]},b.dataTypes[0]="json",f=a[e],a[e]=function(){g=arguments},d.always(function(){a[e]=f,b[e]&&(b.jsonpCallback=c.jsonpCallback,Gc.push(e)),g&&n.isFunction(f)&&f(g[0]),g=f=void 0}),"script"):void 0}),n.parseHTML=function(a,b,c){if(!a||"string"!=typeof a)return null;"boolean"==typeof b&&(c=b,b=!1),b=b||l;var d=v.exec(a),e=!c&&[];return d?[b.createElement(d[1])]:(d=n.buildFragment([a],b,e),e&&e.length&&n(e).remove(),n.merge([],d.childNodes))};var Ic=n.fn.load;n.fn.load=function(a,b,c){if("string"!=typeof a&&Ic)return Ic.apply(this,arguments);var d,e,f,g=this,h=a.indexOf(" ");return h>=0&&(d=n.trim(a.slice(h)),a=a.slice(0,h)),n.isFunction(b)?(c=b,b=void 0):b&&"object"==typeof b&&(e="POST"),g.length>0&&n.ajax({url:a,type:e,dataType:"html",data:b}).done(function(a){f=arguments,g.html(d?n("<div>").append(n.parseHTML(a)).find(d):a)}).complete(c&&function(a,b){g.each(c,f||[a.responseText,b,a])}),this},n.expr.filters.animated=function(a){return n.grep(n.timers,function(b){return a===b.elem}).length},"function"==typeof define&&define.amd&&define("jquery",[],function(){return n});var Jc=a.jQuery,Kc=a.$;return n.noConflict=function(b){return a.$===n&&(a.$=Kc),b&&a.jQuery===n&&(a.jQuery=Jc),n},typeof b===U&&(a.jQuery=a.$=n),n});
//# sourceMappingURL=jquery.min.map
},{}],22:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var VIROOL = require('./js/utils/virool_namespace');
var $ = require('./js/vendor/jquery');
var _ = require('./js/utils/lambda');

var _require = require('./js/backfill/loader/event_tracker');

var track = _require.track;
var _track_url = _require._track_url;

var callbacks = require('./js/backfill/loader/callbacks');
var find_placement = require('./js/backfill/loader/placement_finder');
var html = require('./js/backfill/loader/html');
var checkers = require('./js/backfill/loader/checkers');
var rubicon_tracker = require('./js/backfill/loader/rubicon_tracker');

var _require2 = require('./js/backfill/loader/config');

var DEFAULT_PARAMS = _require2.DEFAULT_PARAMS;
var REGION = _require2.REGION;
var VIROOL_SITE_ID = _require2.VIROOL_SITE_ID;
var postMessage = _require2.postMessage;
var scriptElem = _require2.scriptElem;
var unitContext = _require2.unitContext;
var isFriendlyIframe = _require2.isFriendlyIframe;
var WIDGET_CONFIG_KEYS = _require2.WIDGET_CONFIG_KEYS;
var selfContext = _require2.selfContext;

var BackfillLoader = (function () {
  function BackfillLoader() {
    var _this = this;

    var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, BackfillLoader);

    this.id = 'wb' + _.randHex(9);
    this.passbackId = 'passback-' + this.id;
    this.params = _.extend({}, DEFAULT_PARAMS, params);
    rubicon_tracker.setParams(this.params);
    this.rubicon_tracker = rubicon_tracker;
    checkers.startOpportunityChecker(this);
    callbacks.subscribeAll(params.callbacks || {});
    find_placement(this, function (element, position) {
      _this.elem = $(element);
      _this.renderPosition = position;
      _this.initEvents();
      html.cleanAppend(_this, unitContext.VRL_INLINE_UNITS);
      checkers.runAnchorChecker(_this, sendPlayTracking);
      checkers.runVisibilityChecker(_this);
      callbacks.trigger('oninit', _this);
    });
    track('load_' + (this.params.is_mobile ? 'mobile' : 'desktop'), { region: REGION, site_id: VIROOL_SITE_ID });
  }

  _createClass(BackfillLoader, [{
    key: 'send',
    value: function send(data) {
      postMessage.sendToFrame(this.iframe.get(0), data);
    }
  }, {
    key: 'showUnit',
    value: function showUnit() {
      this.unit_shown = true;
      this.container.css({ position: '', left: '', height: 0 });
      this.container.animate({ height: '100%' }, 400);
    }
  }, {
    key: 'removeUnit',
    value: function removeUnit() {
      callbacks.trigger('oncollapse', this);
      this.unit_removed = true;
      checkers.onRemove();
      this.anchor.remove();
      this.container.remove();
    }
  }, {
    key: 'closeUnit',
    value: function closeUnit() {
      var _this2 = this;

      this.container.animate({ height: 0 }, 400, function () {
        _this2.removeUnit();
      });
    }
  }, {
    key: 'onAdReady',
    value: function onAdReady(message) {
      this.player_ready = true;
      callbacks.trigger('onadready', this);
      track('ready', { data: message.data, site_id: VIROOL_SITE_ID, region: REGION });
      rubicon_tracker.track('ad_ready');
    }
  }, {
    key: 'onAdFailed',
    value: function onAdFailed(reason) {
      var fakeInlineUnitObj = {
        id: this.id,
        passbackId: 'passback-' + this.id,
        context: unitContext,
        contextDoc: unitContext.document,
        selfContext: selfContext,
        selfContextDoc: selfContext.document,
        scriptTag: scriptElem.get(0),
        $: $,
        _: _
      };
      callbacks.trigger('onadfail', this, reason);
      this.unit_shown ? this.closeUnit() : this.removeUnit();
      if ($.isFunction(selfContext.onViroolInlineNoAds)) {
        selfContext.onViroolInlineNoAds.call(fakeInlineUnitObj, this.id);
      }
      track('error', { site_id: VIROOL_SITE_ID });
      rubicon_tracker.track('ad_failed', { exception: reason });
    }
  }, {
    key: 'initEvents',
    value: function initEvents() {
      var _this3 = this;

      postMessage.addJsonListener(function (message) {
        if ('' + _this3.id !== '' + message.id) {
          return;
        }
        switch (message.type) {
          case 'layout_ready':
            var initConf = _.pick(_this3.params, WIDGET_CONFIG_KEYS);
            _this3.send({ type: 'init_player', config: initConf });
            return;
          case 'ad_ready':
            _this3.onAdReady(message);
            return;
          case 'api_error':
            track('api_error', { site_id: VIROOL_SITE_ID });
            return;
          case 'ad_failed':
            _this3.onAdFailed(message.message);
            return;
          case 'content_type':
            track('type', { type: message.contentType, site_id: VIROOL_SITE_ID });
            return;
          case 'impression':
            if (_this3.params.dfp_view) {
              _track_url(_this3.params.dfp_view);
            }
            track('vast_impression', { site_id: VIROOL_SITE_ID });
            rubicon_tracker.track('impression');
            callbacks.trigger('onimpression', _this3);
            return;
          case 'no_ads':
            track('no_ads', { site_id: VIROOL_SITE_ID });
            return;
          case 'click':
            if (_this3.params.clickthrough_url) {
              _track_url(_this3.params.clickthrough_url);
            }
            callbacks.trigger('onclickthrough', _this3);
            track('vast_click', { site_id: VIROOL_SITE_ID });
            return;
          case 'close':
            track('click_close', { site_id: VIROOL_SITE_ID });
            rubicon_tracker.track('click_close');
            callbacks.trigger('onclose', _this3);
          case 'playback_complete':
            track('complete', { site_id: VIROOL_SITE_ID });
            callbacks.trigger('oncomplete', _this3);
            _this3.closeUnit();
            return;
          default:
            return;
        }
      });
    }
  }]);

  return BackfillLoader;
})();

track('start_loading', { region: REGION, site_id: VIROOL_SITE_ID, site_id: VIROOL_SITE_ID });
track(isFriendlyIframe ? "dfp_load" : "classic_load", { site_id: VIROOL_SITE_ID });
var sendPlayTracking = _.once(function () {
  track('play', { site_id: VIROOL_SITE_ID, region: REGION });
});

// TODO global fn without namespace
var initWidget = window.initWidget = VIROOL.initUnit = function (config) {
  if (config.silent || window.skipWidgetInit) {
    return;
  }
  if (config.script_tag) {
    scriptElem = $(config.script_tag);
  }
  var unit = new BackfillLoader(config);
  unitContext.VRL_INLINE_UNITS = unitContext.VRL_INLINE_UNITS || [];
  unitContext.VRL_INLINE_UNITS.push(unit);
};

},{"./js/backfill/loader/callbacks":1,"./js/backfill/loader/checkers":2,"./js/backfill/loader/config":3,"./js/backfill/loader/event_tracker":4,"./js/backfill/loader/html":5,"./js/backfill/loader/placement_finder":6,"./js/backfill/loader/rubicon_tracker":7,"./js/utils/lambda":11,"./js/utils/virool_namespace":20,"./js/vendor/jquery":21}],23:[function(require,module,exports){
/*!
  * Bowser - a browser detector
  * https://github.com/ded/bowser
  * MIT License | (c) Dustin Diaz 2015
  */

!function (name, definition) {
  if (typeof module != 'undefined' && module.exports) module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(definition)
  else this[name] = definition()
}('bowser', function () {
  /**
    * See useragents.js for examples of navigator.userAgent
    */

  var t = true

  function detect(ua) {

    function getFirstMatch(regex) {
      var match = ua.match(regex);
      return (match && match.length > 1 && match[1]) || '';
    }

    function getSecondMatch(regex) {
      var match = ua.match(regex);
      return (match && match.length > 1 && match[2]) || '';
    }

    var iosdevice = getFirstMatch(/(ipod|iphone|ipad)/i).toLowerCase()
      , likeAndroid = /like android/i.test(ua)
      , android = !likeAndroid && /android/i.test(ua)
      , chromeBook = /CrOS/.test(ua)
      , edgeVersion = getFirstMatch(/edge\/(\d+(\.\d+)?)/i)
      , versionIdentifier = getFirstMatch(/version\/(\d+(\.\d+)?)/i)
      , tablet = /tablet/i.test(ua)
      , mobile = !tablet && /[^-]mobi/i.test(ua)
      , result

    if (/opera|opr/i.test(ua)) {
      result = {
        name: 'Opera'
      , opera: t
      , version: versionIdentifier || getFirstMatch(/(?:opera|opr)[\s\/](\d+(\.\d+)?)/i)
      }
    }
    else if (/yabrowser/i.test(ua)) {
      result = {
        name: 'Yandex Browser'
      , yandexbrowser: t
      , version: versionIdentifier || getFirstMatch(/(?:yabrowser)[\s\/](\d+(\.\d+)?)/i)
      }
    }
    else if (/windows phone/i.test(ua)) {
      result = {
        name: 'Windows Phone'
      , windowsphone: t
      }
      if (edgeVersion) {
        result.msedge = t
        result.version = edgeVersion
      }
      else {
        result.msie = t
        result.version = getFirstMatch(/iemobile\/(\d+(\.\d+)?)/i)
      }
    }
    else if (/msie|trident/i.test(ua)) {
      result = {
        name: 'Internet Explorer'
      , msie: t
      , version: getFirstMatch(/(?:msie |rv:)(\d+(\.\d+)?)/i)
      }
    } else if (chromeBook) {
      result = {
        name: 'Chrome'
      , chromeBook: t
      , chrome: t
      , version: getFirstMatch(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)
      }
    } else if (/chrome.+? edge/i.test(ua)) {
      result = {
        name: 'Microsoft Edge'
      , msedge: t
      , version: edgeVersion
      }
    }
    else if (/chrome|crios|crmo/i.test(ua)) {
      result = {
        name: 'Chrome'
      , chrome: t
      , version: getFirstMatch(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)
      }
    }
    else if (iosdevice) {
      result = {
        name : iosdevice == 'iphone' ? 'iPhone' : iosdevice == 'ipad' ? 'iPad' : 'iPod'
      }
      // WTF: version is not part of user agent in web apps
      if (versionIdentifier) {
        result.version = versionIdentifier
      }
    }
    else if (/sailfish/i.test(ua)) {
      result = {
        name: 'Sailfish'
      , sailfish: t
      , version: getFirstMatch(/sailfish\s?browser\/(\d+(\.\d+)?)/i)
      }
    }
    else if (/seamonkey\//i.test(ua)) {
      result = {
        name: 'SeaMonkey'
      , seamonkey: t
      , version: getFirstMatch(/seamonkey\/(\d+(\.\d+)?)/i)
      }
    }
    else if (/firefox|iceweasel/i.test(ua)) {
      result = {
        name: 'Firefox'
      , firefox: t
      , version: getFirstMatch(/(?:firefox|iceweasel)[ \/](\d+(\.\d+)?)/i)
      }
      if (/\((mobile|tablet);[^\)]*rv:[\d\.]+\)/i.test(ua)) {
        result.firefoxos = t
      }
    }
    else if (/silk/i.test(ua)) {
      result =  {
        name: 'Amazon Silk'
      , silk: t
      , version : getFirstMatch(/silk\/(\d+(\.\d+)?)/i)
      }
    }
    else if (android) {
      result = {
        name: 'Android'
      , version: versionIdentifier
      }
    }
    else if (/phantom/i.test(ua)) {
      result = {
        name: 'PhantomJS'
      , phantom: t
      , version: getFirstMatch(/phantomjs\/(\d+(\.\d+)?)/i)
      }
    }
    else if (/blackberry|\bbb\d+/i.test(ua) || /rim\stablet/i.test(ua)) {
      result = {
        name: 'BlackBerry'
      , blackberry: t
      , version: versionIdentifier || getFirstMatch(/blackberry[\d]+\/(\d+(\.\d+)?)/i)
      }
    }
    else if (/(web|hpw)os/i.test(ua)) {
      result = {
        name: 'WebOS'
      , webos: t
      , version: versionIdentifier || getFirstMatch(/w(?:eb)?osbrowser\/(\d+(\.\d+)?)/i)
      };
      /touchpad\//i.test(ua) && (result.touchpad = t)
    }
    else if (/bada/i.test(ua)) {
      result = {
        name: 'Bada'
      , bada: t
      , version: getFirstMatch(/dolfin\/(\d+(\.\d+)?)/i)
      };
    }
    else if (/tizen/i.test(ua)) {
      result = {
        name: 'Tizen'
      , tizen: t
      , version: getFirstMatch(/(?:tizen\s?)?browser\/(\d+(\.\d+)?)/i) || versionIdentifier
      };
    }
    else if (/safari/i.test(ua)) {
      result = {
        name: 'Safari'
      , safari: t
      , version: versionIdentifier
      }
    }
    else {
      result = {
        name: getFirstMatch(/^(.*)\/(.*) /),
        version: getSecondMatch(/^(.*)\/(.*) /)
     };
   }

    // set webkit or gecko flag for browsers based on these engines
    if (!result.msedge && /(apple)?webkit/i.test(ua)) {
      result.name = result.name || "Webkit"
      result.webkit = t
      if (!result.version && versionIdentifier) {
        result.version = versionIdentifier
      }
    } else if (!result.opera && /gecko\//i.test(ua)) {
      result.name = result.name || "Gecko"
      result.gecko = t
      result.version = result.version || getFirstMatch(/gecko\/(\d+(\.\d+)?)/i)
    }

    // set OS flags for platforms that have multiple browsers
    if (!result.msedge && (android || result.silk)) {
      result.android = t
    } else if (iosdevice) {
      result[iosdevice] = t
      result.ios = t
    }

    // OS version extraction
    var osVersion = '';
    if (result.windowsphone) {
      osVersion = getFirstMatch(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i);
    } else if (iosdevice) {
      osVersion = getFirstMatch(/os (\d+([_\s]\d+)*) like mac os x/i);
      osVersion = osVersion.replace(/[_\s]/g, '.');
    } else if (android) {
      osVersion = getFirstMatch(/android[ \/-](\d+(\.\d+)*)/i);
    } else if (result.webos) {
      osVersion = getFirstMatch(/(?:web|hpw)os\/(\d+(\.\d+)*)/i);
    } else if (result.blackberry) {
      osVersion = getFirstMatch(/rim\stablet\sos\s(\d+(\.\d+)*)/i);
    } else if (result.bada) {
      osVersion = getFirstMatch(/bada\/(\d+(\.\d+)*)/i);
    } else if (result.tizen) {
      osVersion = getFirstMatch(/tizen[\/\s](\d+(\.\d+)*)/i);
    }
    if (osVersion) {
      result.osversion = osVersion;
    }

    // device type extraction
    var osMajorVersion = osVersion.split('.')[0];
    if (tablet || iosdevice == 'ipad' || (android && (osMajorVersion == 3 || (osMajorVersion == 4 && !mobile))) || result.silk) {
      result.tablet = t
    } else if (mobile || iosdevice == 'iphone' || iosdevice == 'ipod' || android || result.blackberry || result.webos || result.bada) {
      result.mobile = t
    }

    // Graded Browser Support
    // http://developer.yahoo.com/yui/articles/gbs
    if (result.msedge ||
        (result.msie && result.version >= 10) ||
        (result.yandexbrowser && result.version >= 15) ||
        (result.chrome && result.version >= 20) ||
        (result.firefox && result.version >= 20.0) ||
        (result.safari && result.version >= 6) ||
        (result.opera && result.version >= 10.0) ||
        (result.ios && result.osversion && result.osversion.split(".")[0] >= 6) ||
        (result.blackberry && result.version >= 10.1)
        ) {
      result.a = t;
    }
    else if ((result.msie && result.version < 10) ||
        (result.chrome && result.version < 20) ||
        (result.firefox && result.version < 20.0) ||
        (result.safari && result.version < 6) ||
        (result.opera && result.version < 10.0) ||
        (result.ios && result.osversion && result.osversion.split(".")[0] < 6)
        ) {
      result.c = t
    } else result.x = t

    return result
  }

  var bowser = detect(typeof navigator !== 'undefined' ? navigator.userAgent : '')

  bowser.test = function (browserList) {
    for (var i = 0; i < browserList.length; ++i) {
      var browserItem = browserList[i];
      if (typeof browserItem=== 'string') {
        if (browserItem in bowser) {
          return true;
        }
      }
    }
    return false;
  }

  /*
   * Set our detect method to the main bowser object so we can
   * reuse it to test other user agents.
   * This is needed to implement future tests.
   */
  bowser._detect = detect;

  return bowser
});

},{}]},{},[22])