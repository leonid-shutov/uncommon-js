({
  method: () => {
    try {
      console.log(foo);
    } catch {
      console.log('foo is not defined');
    }

    console.log(bar);
    console.log(Dir.fun());
  },
});
