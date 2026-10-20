// 公共服务器配置
const serverConfig = {
  // 服务器IP地址
  ip: {
    development: '127.0.0.1',   // 开发环境IP（本机后端）
    // development: '192.168.1.12', // 真机-办公室
    production: '172.100.1.91' // 生产环境后端IP
  },

  // 各服务端口配置
  ports: {
    http: 7005 // 后端HTTP API服务端口
  },

  // 菜鸟大包查询接口地址（路径与后端模拟接口一致：/api-intranet/trans/packageData/getBigPackageToMCS）
  cainiaoBaseUrl: {
    development: '',                    // 开发环境走后端模拟接口（与后端同地址）
    production: 'http://10.135.246.231:8080' // 生产环境直连菜鸟接口
  },

  // 根据环境获取当前后端IP
  getCurrentIP() {
    return process.env.NODE_ENV === 'development'
      ? this.ip.development
      : this.ip.production;
  },

  // 获取后端HTTP服务完整地址
  getHttpUrl() {
    return `http://${this.getCurrentIP()}:${this.ports.http}`;
  },

  // 获取菜鸟大包查询接口完整地址（开发环境走后端模拟）
  getCainiaoUrl() {
    if (process.env.NODE_ENV === 'development') {
      return this.getHttpUrl();
    }
    return this.cainiaoBaseUrl.production;
  }
};

export default serverConfig;
