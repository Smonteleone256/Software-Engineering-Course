import React from "react"
import IngredientsList from "./components/IngredientsList"
import ClaudeRecipe from "./components/ClaudeRecipe"
import { getRecipeFromChefClaude, getRecipeFromMistral } from "./ai"

export default function Main() {
    const [ingredients, setIngredients] = React.useState([])
    const [aiCall, setAiCall] = React.useState()

    async function toggleRecipeShown() {
        let call = await getRecipeFromChefClaude(ingredients)
        await setAiCall(prevAiCall => call)
    }

    function addIngredient(formData) {
        const newIngredient = formData.get("ingredient")
        setIngredients(prevIngredients => [...prevIngredients, newIngredient])
    }

    return (
        <main>
            <form action={addIngredient} className="add-ingredient-form">
                <input
                    type="text"
                    placeholder="e.g. oregano"
                    aria-label="Add ingredient"
                    name="ingredient"
                />
                <button>Add ingredient</button>
            </form>

            {ingredients.length > 0 &&
                <IngredientsList
                    ingredients={ingredients}
                    aiCall={aiCall}
                    toggleRecipeShown={toggleRecipeShown}
                />
            }

            {aiCall && <ClaudeRecipe aiCall={aiCall} />}
        </main>
    )
}