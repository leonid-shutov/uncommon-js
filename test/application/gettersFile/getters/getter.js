() => {
  console.log(`This shouldn't be logged during loading`);
  return $.module.value;
};
