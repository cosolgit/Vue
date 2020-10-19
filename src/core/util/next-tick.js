/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

export let isUsingMicroTask = false

const callbacks = []
let pending = false

function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    //先添加的回调函数先执行
    //@example
    //data(){return { msg:'hello world' }}
    //this.$nextTick(()=>{console.log(this.$refs.msg.innerHTML)})
    //this.msg = 'hello vue'
    //console.log(this.$refs.msg.innerHTML)
    //最后输出的是2个hello world,因为第一个nextTick将回调push到callbacks,修改msg会将渲染视图的回调(flushSchedulerQueue)push到callbacks
    //但是由于是按顺序遍历数组,nextTick的回调会先执行,所以仍然输出的是'hello world'
    copies[i]()
  }
}

// Here we have async deferring wrappers using microtasks.
// In 2.5 we used (macro) tasks (in combination with microtasks).
// However, it has subtle problems when state is changed right before repaint
// (e.g. #6813, out-in transitions).
// Also, using (macro) tasks in event handler would cause some weird behaviors
// that cannot be circumvented (e.g. #7109, #7153, #7546, #7834, #8109).
// So we now use microtasks everywhere, again.
// A major drawback of this tradeoff is that there are some scenarios
// where microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690, which have workarounds)
// or even between bubbling of the same event (#6566).
let timerFunc//把flushCallbacks注册为microtask

// The nextTick behavior leverages the microtask queue, which can be accessed
// via either native Promise.then or MutationObserver.
// MutationObserver has wider support, however it is seriously bugged in
// UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
// completely stops working after triggering a few times... so, if native
// Promise is available, we will use it:
/* istanbul ignore next, $flow-disable-line */
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  timerFunc = () => {
    p.then(flushCallbacks)
    // In problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
  isNative(MutationObserver) ||
  // PhantomJS and iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // Fallback to setImmediate.
  // Technically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.
  //setTimeout将回调函数注册为(macro)task 之前要不停的做超时检测，而 setImmediate(有兼容性) 则不需要
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else {
  // Fallback to setTimeout.
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}
/*
  当调用栈空闲后每次事件循环只会从 (macro)task 中读取一个任务并执行，
  而在同一次事件循环内会将 microtask 队列中所有的任务全部执行完毕，且要先于 (macro)task。
  另外 (macro)task 中两个不同的任务之间可能穿插着UI的重渲染，
  那么我们只需要在 microtask 中把所有在UI重渲染之前需要更新的数据全部更新，这样只需要一次重渲染就能得到最新的DOM了
*/
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      //不传递回调函数,将this.$nextTick这个Promise的状态变为resolve,就会跳到then调用
      _resolve(ctx)
    }
  })
  if (!pending) {
    //回调队列是否处于执行的状态
    pending = true
    //只有第一次调用$nextTick时才会执行,将flushCallbacks注册为microtask,等待调用栈被清空后才执行,callbacks回调队列包含了本次事件循环所有通过$nextTick注册的回调
    //然后执行flushCallbacks,将回调执行清空
    timerFunc()
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
