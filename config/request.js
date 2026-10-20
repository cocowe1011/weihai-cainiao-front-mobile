import serverConfig from './common.js'

// 后端API请求配置
const config = {
  baseUrl: serverConfig.getHttpUrl(),
  timeout: 8000
}

// 菜鸟大包查询请求配置（开发环境走后端模拟，生产环境直连菜鸟）
const cainiaoConfig = {
  baseUrl: serverConfig.getCainiaoUrl(),
  timeout: 2000
}

// 通用请求方法
const doRequest = (baseCfg, options) => {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      url: baseCfg.baseUrl + options.url,
      timeout: baseCfg.timeout,
      success: (res) => {
        resolve(res.data)
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

// 后端API请求封装
const request = {
  get: (url, data = {}) => doRequest(config, { url, method: 'GET', data }),
  post: (url, data = {}) => doRequest(config, { url, method: 'POST', data })
}

// 菜鸟大包查询请求封装
export const cainiaoRequest = {
  post: (url, data = {}) => doRequest(cainiaoConfig, { url, method: 'POST', data })
}

export default request
