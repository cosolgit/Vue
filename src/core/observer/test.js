const data = {
    a: 1,
    b: {
        c:2
    }
  }
  
  function walk(data){
      for(let key in data){
          const dep = []
          let val = data[key]
          const nativeString = Object.prototype.toString.call(val)
          if(nativeString==="[object Object]"){
              walk(val)
          }
          Object.defineProperty(data, key, {
              set (newVal) {
                  if(newVal === val)return
                  val = newVal
                  dep.forEach(fn => fn())
              },
              get () {
                  // 此时 Target 变量中保存的就是依赖函数
                  dep.push(Target)
                  return val
              }
          })
      }
  }
  
  walk(data)
  // Target 是全局变量
  let Target = null
  function $watch (exp, fn) {
    // 将 Target 的值设置为 fn
    Target = fn
    let pathArr,
    obj = data
    if(typeof exp === "function"){
        exp()
        return 
    }
    if(/\./.test(exp)){
      pathArr = exp.split(".")
      pathArr.forEach(p=>{
          obj = obj[p]
      })
      return 
    }
    // 读取字段值，触发 get 函数
    data[exp]
  }
  
  $watch('a',()=>{console.log(111)})
  $watch('a',()=>{console.log(111222)})
  $watch('b.c',()=>{console.log(222)})
  
  data.b.c=222

const mutationMethods = [
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse'
]

// 实现 arrayMethods.__proto__ === Array.prototype
const arrayMethods = Object.create(Array.prototype) 
// 缓存 Array.prototype
const arrayProto = Array.prototype  

mutationMethods.forEach(method => {
    arrayMethods[method] = function (...args) {
        const result = arrayMethods[method].apply(this, args)

        console.log(`执行了代理原型的 ${method} 函数`)

        return result
    }
})

