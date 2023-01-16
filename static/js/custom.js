let options = {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
}
time_fmt = new Intl.DateTimeFormat([], options);


setInterval(() => { 
  times = document.getElementsByClassName('time')

  Array.from(times).forEach((time) => {
    time.innerHTML = time_fmt.format(new Date(),options)
  })
}, 1000)


