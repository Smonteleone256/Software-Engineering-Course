function inventoryItem(name, type, quantity = 1, price = 1000) {
  return (
    <div>
      {<h1>{`${name}, ${"(" + type + ")"}, ${"$" + price}, ${quantity}`}</h1>}

      {
        <h3>
          {quantity < 5 ? (
            <Message>
              <p>
                <span>⚠️</span> Low Stock! {quantity} remaining.
              </p>
            </Message>
          ) : (
            ""
          )}
          {price * quantity > 1000 ? (
            <Message>
              <p>
                <span>💰</span> High value - consider extra protection!
              </p>
            </Message>
          ) : (
            ""
          )}
        </h3>
      }
    </div>
  );
}
