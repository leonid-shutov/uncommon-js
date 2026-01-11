({
  $testGetterMethod: () => {
    console.log(`This shouldn't be logged during loading`);
    return self.value;
  },
  value: 'getter-method',
});
