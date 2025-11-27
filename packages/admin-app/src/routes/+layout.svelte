<script lang="ts">
  import { onMount } from 'svelte'
  import { auth } from '$lib/stores'
  import '../app.css'
  
  let { children } = $props()
  
  onMount(() => {
    auth.init()
  })
</script>

<div class="app">
  {@render children()}
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
</style>
