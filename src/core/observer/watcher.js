/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    //
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user//是 用户定义的(通过watch或$watch函数定义的观察者,回调函数是开发者写的) 还是 内部定义的
      this.lazy = !!options.lazy//是否是computed的watcher
      this.sync = !!options.sync//当数据变化时是否同步求值并执行回调
      this.before = options.before//watcher实例的钩子,当数据变化之后,触发更新之前,
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    //只有computed watcher才有dirty,是否需要重新执行
    this.dirty = this.lazy // for lazy watchers
    //newDepIds 用来在一次求值中避免收集重复的观察者
    //每次求值收集观察者完成后,将newDepIds 和 newDeps赋值给depIds和 deps,并清空
    //depIds 用来避免重复求值时收集重复的观察者
    //newDepIds 和 newDeps当次求值收集到的dep实例对象
    //depIds和deps上次求值过程中收集到的对象
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    //提示错误
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      //parsePath解析失败了
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    //保存着被观察目标的值
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  /*
    求值
    1.触发访问器属性的get
    2.获得被观察目标的值
  */
  get () {
    pushTarget(this)//将当前user-watcher实例赋值给Dep.target，读取时收集它
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm) // 将vm实例传给闭包，进行读取操作
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    //避免在一次求值过程收集重复依赖
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      //避免在多次求值过程收集重复依赖
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      //上次求值收集到的Dep实例对象是否存在于这次求值所收集到的Dep实例中.不存在说明该Dep对象和观察者不存在依赖关系
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      //只有当依赖改变才会dirty=true重新计算
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      //对于渲染函数观察者,this.get就是updateComponent函数的返回值undefined
      const value = this.get()
      if (
        //新旧值不相等执行回调
        //如果是对象,引用不变也执行回调
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    //惰性求值
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    //renderWatcher
    /*
      data(){return {a:1}}
      compA(){return this.a+1}
      compA依赖a,a收集计算属性观察者对象,计算属性观察者对象收集渲染函数观察者对象
      执行完evaluate后,computed watcher弹出栈
    */
    /*
      computed内的响应式数据会收集computed-watcher和render-watcher两个watcher,
      当computed内的状态发生变更触发set后,首先触发update通知computed需要进行重新计算,
      然后通知到视图执行渲染，再渲染中会访问到computed计算后的值，最后渲染到页面
    */
    //计算属性内的值须是响应式数据才能触发重新计算。
    let i = this.deps.length// deps内是计算属性内能访问到的响应式数据的dep的数组集合
    while (i--) {
      this.deps[i].depend()//每个dep收集当前的render-watcher
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      //组件是否被销毁  
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
