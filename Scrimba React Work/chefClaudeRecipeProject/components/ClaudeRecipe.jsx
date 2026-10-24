export default function ClaudeRecipe(props) {
    return (
        <section>
            <h2>Chef Claude Recommends:</h2>
            <article>{props.aiCall}</article>
        </section>
    )
}