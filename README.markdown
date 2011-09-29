# a very simple project health measurement tool for projects on GitHub

## About

The lib looks at the number of commits over the last 30 many days to ascertain
how 'healthy' the project is. It generates a health-bar as an HTML5 canvas
widget, or a series of adjacent span elements if canvas isn't supported.
Requires jQuery.


## Usage

```javascript
$(document).ready(function() {
  var project = 'username/project/branch';
  hubStatus.status(project, function(widget, health, data) {
    ('body').append( $('<div>' +
      project + ' has had at least ' + data.numCommits + ' commits in the last 30 days, by at least ' +
      data.numCommitters + ' committer.<br/>Its health is rated as ' + health*100 + '%<br/> </div>')
    );
    $('body').append(widget);
  });
});

```

Look at index.html.

## Advanced usage

Look at the source - there are three methods with inline docs that you can use
directly if 'status' isn't doing it for you.

## TODO:

  + Better error handling, if the repo doesn't exist then it's treated as if it
    has zero commits rather than saying "wait, this isn't right".
  + More customisation and analysis in how it calculates health
  + A nice graph of commits over time would be, er, nice.


## but this doesn't accurately reflect the health of my project!

No, it very possibly doesn't. Looking at trends over a longer length of time
would be better, but it would involve more network requests and make it slower
to appear on a web-page. But you are welcome to make it more configurable :)
