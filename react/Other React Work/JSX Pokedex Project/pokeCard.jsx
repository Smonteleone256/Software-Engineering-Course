export default function PokeCard(id, name, type, base_experience) {
  return (
    <h1>
      {`${id}`},{`${name}`},{`${type}`},{`${base_experience}`}
      <img
        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`}
      />
    </h1>
  );
}
