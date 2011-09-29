(function($) {
  var HEALTHY = 15; // number of commits in last 30 days which specifies a
  // fully healthy project
  hubStatus = {
    /**
     * Fetches the data about a given project. The data is passed to the
     * callback function as an object. Its keys are currently
     *  numCommits and numCommitters
     * @param {string} : the username/project/branch path to the project on
     *  github
     * @param {function} : the callback to receive the data
     * @param {int} limit: the number of commits you're interested in. It's
     * worth specifying this because GitHub paginates the data, so if your
     * repo's history is hundreds of commits long, it will take a long time to
     * retrieve it all.
     */
    get: function(project, callback, limit) {
      var N = 1, 
          url = 'https://github.com/api/v2/json/commits/list/' + project,
          now = new Date(),
          committers = {},
          num_commits = 0,
          timeout_handler = null; // timeout to handle 404 errors and whatnot,
      // which jquery doesn't seem to allow you to catch very easily
      
      var __finish = function() {
        var num_committers = 0;
        for (var key in committers) num_committers++;
        if (callback) {
          callback({
            numCommits: num_commits,
            numCommitters: num_committers
          });
        }
      };

      var __get = function(data) {
        clearTimeout(timeout_handler);
        var quit = N > 1 && data.commits.length == 0;

        for (var i=0; !quit && N > 1 && i<data.commits.length; i++) {
          var d = data.commits[i];
          var regexp = new RegExp(/^(\d{4})\-(\d{2})-(\d{2})/);
          var result;
          if ((result = regexp.exec(d.authored_date))) {
            var date = new Date();
            var cutoff = new Date().getTime()/1000 - 30*24*60*60;
            // Fairly approximate since we don't take into account time zones
            // or anything, this might sometimes be out by one day.
            var day = parseInt(result[3], 10),
              month = parseInt(result[2], 10)-1,
              year = parseInt(result[1], 10);
            date = new Date(year, month, day);

            if (date.getTime()/1000 < cutoff) {
              quit = true;
            }

            num_commits++;
            if (typeof limit !== undefined && num_commits > limit)
              quit = true;
          } else {
            quit = true;
          }
          committers[d['author']] = true;
        };

        if (quit) {
          __finish();
          return false;
        }

        setTimeout(function() {
          $.getJSON(url + '?page=' + N++ + '&callback=?', __get);
          timeout_handler = setTimeout(__finish, 5000);
        }, 500);
        
      };
      __get();
    },

    /**
     * Calculates the health of a project
     * The project may be given either as an object returned from get, or
     * as a string which represents the username/project/branch structure. If
     * the latter, an asynchronous request is performed, and the return value
     * is passed to the callback which you must specify, otherwise you
     * will not  be able to retrive the data.
     */
    health: function(project_or_data, callback) {
      var project, data;
      if (typeof project_or_data.numCommits !== 'undefined') {
        data = project_or_data;
      } else {
        project = project_or_data;
      }
      
      var fire_cb = function(data) {
        hubStatus.health(data, callback);
      }
      if (typeof project !== 'undefined') {
        hubStatus.get(project, fire_cb)
        return;
      } else {
        var health = Math.min(1, data.numCommits/HEALTHY);
        if (callback) callback(health);
        else return health;
      }
    },

    /*
     * Generates a healthometer, YES A HEALTHOMETER.
     * @param {number} health : a real number between 0 and 1 inclusive.
     */
    widget: function(health, width, height) {
      width = width || 200, height = height || 10, interval = 2; // interval is our delta
      var canvas = $('<canvas height=' + height + ' width=' + width +'>');
      var use_canvas  = !!canvas.get(0).getContext;
      var ctx = use_canvas? canvas.get(0).getContext('2d') : null;
      
      if (!use_canvas) {
        // fallback
        canvas = $('<div>').css( {height: height + 'px', width: width + 'px'} );
      }
      // we're going to use the HSV colour representation because we can
      // simply interpolate the hue from 20 to 120 degrees to get a nice red to
      // green transition.
      // Technically we could start at 0, but the scale looks more natural if
      // we offset it by the initial 20
      var offset = 20;
      health = Math.max(0, Math.min(1, health));
      target = parseInt(health * 120); // 120 degrees, hue value
      

      var w_ = 0; // this is our accumulator
      while (w_ < width) {
        var h = w_/width * target + offset, s = 1, v = 1;
        var rgb;
        // HSV conversion, bit ugly
        // http://en.wikipedia.org/wiki/HSL_and_HSV#From_HSV

        var C = v * s;
        var hprime = h/60;
        var X = C * (1 - Math.abs(hprime % 2 - 1));
        if (0 <= hprime && hprime < 1)
          rgb =  [C, X, 0];
        else if(1 <= hprime && hprime < 2)
          rgb = [X, C, 0];
        else if (2 <= hprime && hprime < 3)
          rgb = [0, C, X];
        else if (3 <= hprime && hprime < 4)
          rgb = [0, X, C];
        else if (4 <= hprime && hprime < 5)
          rgb = [X, 0, C];
        else if (5 <= hprime && hprime < 6)
          rgb = [C, 0, X];
        for (var i=0; i<rgb.length; i++) {
          // we've got to parseint it or the rgb function seems to
          // set it to zero
          rgb[i] = parseInt((rgb[i] + C-v)*255);
        }

        var colour = 'rgb(' + rgb.join(', ') + ')';
        if (use_canvas) {
          ctx.save()
          ctx.fillStyle = colour;
          ctx.fillRect(w_, 0, interval, height);
          ctx.restore();
        } else {
          var block = $('<span>').css( {
            display: 'inline-block',
            width: interval + 'px',
            height: height + 'px',
            'background-color': colour,
            margin : '0'
          });
          canvas.append(block);
        }

        w_ += interval;
      }
      return canvas;
    },

  /**
   * High level function. Generates the widget and all useful information.
   * @param {string} project : Like get, project should be in the form
   *   username/project/branch
   * @param {function} callback: Because we use an asynchronous request,
   * you must provide a callback to receive your data. The callback will
   * recieve three arguments: widget (the health widget), health (as a real
   * number between 0 and 1), and data, which is the same as given by get().
   */
  status : function(project, callback) {
    var get_cb = function(data) {
      var health = hubStatus.health( data );
      callback(hubStatus.widget(health), health, data);
    }
    hubStatus.get(project, get_cb, HEALTHY);
  }
  };
})(jQuery);
