<script lang="ts">
type Props = {
	width?: number;
	className?: string;
};

const { width = 200, className = '' }: Props = $props();
const height = $derived(width / 4);
const classValue = $derived(className);
const imageStyle = $derived(`width: ${width}px; height: ${height}px;`);
</script>

<img
	class={classValue}
	src="/logo.png"
	alt="u29dc"
	style={imageStyle}
/>
