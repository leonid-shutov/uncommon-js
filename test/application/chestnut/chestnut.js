'use strict';

({
  age: 0,
  isRotten: false,
  isRipe: () => self.age === 1,
  rot: {
    method: () => (self.isRotten = true),
  },
});
