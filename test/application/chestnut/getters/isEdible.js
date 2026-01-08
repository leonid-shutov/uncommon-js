'use strict';

() => {
  console.log(`This shouldn't be logged during loading`);
  return $.age < 3 && !$.isRotten;
};
