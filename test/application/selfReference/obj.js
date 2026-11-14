({
  ownValue: 'own-value',
  ownFun: () => {
    self.parentFun();
    console.log(self.obj.ownValue);
  },
});
