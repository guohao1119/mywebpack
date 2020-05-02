console.log('b.js')

// 从c文件中引入name变量，在方法中打印该变量
const name = require('./c.js')

const func = () => {
  console.log(name)
}
// 暴露出func方法
module.exports = func