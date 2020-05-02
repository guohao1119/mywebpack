console.log('myy')

const fs = require('fs')
const path = require('path')
const parser= require('@babel/parser')
const babel= require('@babel/core')
const traverse= require('@babel/traverse').default
const generator= require('@babel/generator').default
const ejs = require('ejs')

// 引入配置文件
const config = require('../mypack.config.js')
// 获取配置文件中定义的入口文件
const entry = config.entry
let id = 0 // 模块id

// 1 构建AST
const createAst = filePath => {
  // 读取入口文件中的内容
  const content = fs.readFileSync(filePath, 'utf8')
  // console.log(content)
  // 调用parser中的parse方法将读取到的入口文件中的内容转为ast
  // Node {
  //   type: 'File',
  //   start: 0,
  //   end: 80,
  //   loc:
  //    SourceLocation {
  //      start: Position { line: 1, column: 0 },
  //      end: Position { line: 6, column: 6 } },
  //   errors: [],
  //   program:
  //    Node {
  //      type: 'Program',
  //      start: 0,
  //      end: 80,
  //      loc: SourceLocation { start: [Position], end: [Position] },
  //      sourceType: 'module',
  //      interpreter: null,
  //      body: [ [Node], [Node], [Node] ],
  //      directives: [] },
  //   comments:
  //    [ { type: 'CommentLine',
  //        value: ' 从b文件中引入func方法，并调用',
  //        start: 21,
  //        end: 41,
  //        loc: [SourceLocation] } ] }
  const ast = parser.parse(content, {
    sourceType: 'module'
  })
  // console.log(ast)

  // 存放依赖的数组：将依赖的文件的路径放进去
  let dep = []

  // 单个文件的依赖收集，traverse用来遍历parser生成的ast
  traverse(ast, {
    CallExpression(p) {
      const node = p.node
      // console.log(node)
      // 对语法树中特定的节点进行操作
      // 拿到require方法并进行处理
      if (node.callee.name === 'require') {
        // console.log(node)
        // 将方法名改为__webpack_require__
        node.callee.name = '__mypack_require__'
        // 拿到require中的参数，即文件路径进行处理
        let resultPath = node.arguments[0].value // .b.js
        // 如果没有扩展名则加上
        resultPath = resultPath + (path.extname(resultPath) ? '' : 'js')
        dep.push(resultPath)
      }
    }
  })

  // 将修改后的ast重新生成代码
  // console.log('a.js'); // 从b文件中引入func方法，并调用
  // const func = __webpack_require__('./b.js'); // require方法被替换
  // func();
  let code = generator(ast).code

  console.log(dep)
  console.log(code)

  let moduleId = id++
  let mapping = {}
  return {
    moduleId,
    filePath,
    code,
    mapping,
    dep
  }
}

// 处理多个文件的依赖
const createGraph = entry => {
  // 拿到入口文件的ast
  const ast = createAst(entry)
  // 将入口文件的ast放入一个数组中，进行遍历，将依赖的文件的ast也放入该数组，从而得到所有依赖
  const queue = [ast]

  // 处理绝对路径
  for (const item of queue) {
    // 拿到ast中的文件路径
    const dirname = path.dirname(ast.filePath)

    // 处理依赖（dep中存的都是相对路径，需要转成绝对路径）
    item.dep.map(relativePath => {
      const absolutePath = path.join(dirname, relativePath)
      const child = createAst(absolutePath)
      // 将依赖的模块的路径和id映射起来
      item.mapping[relativePath] = child.moduleId
      queue.push(child)
    })
  }
  // console.log(queue)
  return queue
}

// console.log(createAst(entry))

const modules = createGraph(entry)
const entryId = modules[0].moduleId

// console.log(modules)

let code = []
// 根据modules拿到mapping和code的映射，以便将code中引用的相对路径转为moduleId
modules.map(item => {
  code.push({
    id: item.mapping,
    code: item.code
  })
})
// console.log(code)
// 使用正则匹配__mypack_require__('xxx')将xxx替换为moduleId
let reg = /__mypack_require__\((.+?)\)/g

code = code.map(item => {
  return item.code.replace(reg, `__mypack_require__(${Object.values(item.id)})`)
})

// console.log(code)


// 打包输出
let output = `${config.output.path}/${config.output.filename}`
console.log(output)
let template = fs.readFileSync(path.resolve(__dirname, './template.ejs'), 'utf8')

let package = ejs.render(template, {
  entryId,
  code
})

fs.writeFileSync(output, package)

console.log('打包完成')
