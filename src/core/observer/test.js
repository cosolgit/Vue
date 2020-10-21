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




function fn(func,wait){
    let interv= function(){
      func()
      setTimeout(interv,wait)
    }
    setTimeout(interv)
  }
  
  fn(()=>{console.log(111)},1000)
  


  let resolvePromise = new Promise(resolve => {
    let resolvedPromise = Promise.resolve()
    resolve(resolvedPromise)//Promise.resolve().then(() => resolvedPromise.then(resolve))
  })
  resolvePromise.then(() => {
    console.log('resolvePromise resolved')
  })
  let resolvedPromiseThen = Promise.resolve().then(res => {
    console.log('promise1')
  })
  resolvedPromiseThen
    .then(() => {
      console.log('promise2')
    })
    .then(() => {
      console.log('promise3')
    })

//自定义事件名之前是hook:
//不用在当前实例下挂载一个额外的属性
//可以封装为一个方法,复用更方便
new Vue({
    mounted(){
        this.attachDatepicker("startDateInput")
    },
    methods:{
        attachDatepicker(refName){
            const picker = new new Pikaday({  // Pikaday是一个日期选择库
                field: this.$refs[refName],  // 为input添加日期选择
                format: 'YYYY-MM-DD'
            })

            this.$once('hook:beforeDestroy',() => {//监听beforeDestroy钩子
                picker.destroy()//销毁
            })
        }
    }
})
//跨组件通信,$on要比$emit先执行
export default{
    methods:{
        dispatch(componentName, eventName, params){
            let parent = this.$parent || this.$root;
            let name = parent.$options.name;

            while(parent && (!name || name !== componentName)){
                parent = parent.$parent && parent.$options.name;
            }
            parent && parent.$emit.apply(parent,[eventName].concat(params))
        },
        broadcast(componentName, eventName, params){
            broadcast.call(this, componentName, eventName, params)
        }
    }
}
function broadcast(componentName, eventName, params){
    this.$children.forEach(child => {
        let name = child.$options.name;
        name === componentName
            ? child.$emit.apply(child, [eventName].concat(params))
            : broadcast.call(child, componentName, eventName, params)
    })
}
