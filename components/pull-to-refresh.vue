<template>
  <view class="pull-refresh">
    <view 
      class="refresh-content"
      :style="{ transform: `translateY(${offset}px)` }"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <view class="refresh-header" :class="{ active: refreshing }">
        <loading-spin v-if="refreshing"></loading-spin>
        <text class="refresh-text">{{ refreshText }}</text>
      </view>
      <slot></slot>
    </view>
  </view>
</template>

<script>
import LoadingSpin from './loading-spin.vue'

export default {
  name: 'PullToRefresh',
  components: {
    LoadingSpin
  },
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      startY: 0,
      offset: 0,
      refreshHeight: 50,
      maxOffset: 80
    }
  },
  computed: {
    refreshing: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    refreshText() {
      if (this.refreshing) return '刷新中...'
      return this.offset >= this.refreshHeight ? '释放刷新' : '下拉刷新'
    }
  },
  watch: {
    refreshing(val) {
      if (!val) {
        setTimeout(() => {
          this.offset = 0
        }, 300)
      }
    }
  },
  methods: {
    handleTouchStart(e) {
      this.startY = e.touches[0].clientY
    },
    handleTouchMove(e) {
      if (this.refreshing) return
      
      const moveY = e.touches[0].clientY
      const diff = moveY - this.startY
      
      if (diff > 0) {
        e.preventDefault()
        this.offset = Math.min(diff * 0.5, this.maxOffset)
      }
    },
    handleTouchEnd() {
      if (this.refreshing) return
      
      if (this.offset >= this.refreshHeight) {
        this.refreshing = true
        this.offset = this.refreshHeight
        this.$emit('refresh')
      } else {
        this.offset = 0
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.pull-refresh {
  overflow: hidden;
  
  .refresh-content {
    transition: transform 0.3s;
    
    .refresh-header {
      height: 50px;
      margin-top: -50px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: $text-secondary;
      
      .refresh-text {
        font-size: 28rpx;
        margin-left: 12rpx;
      }
    }
  }
}
</style> 