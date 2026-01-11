({
  value: 'getter-method',
  $getter: () => {
    console.log(`This shouldn't be logged during loading`);
    return self.value;
  },
});
