({
  method: () => {
    try {
      console.log(foo);
    } catch (error) {
      console.log('foo is not defined');
    }

    console.log(bar);
    console.log(Dir.fun());
  },
});
