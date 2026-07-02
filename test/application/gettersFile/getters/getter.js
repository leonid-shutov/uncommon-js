() => {
  console.log(`This shouldn't be logged during loading`);
  return self.module.value;
};
