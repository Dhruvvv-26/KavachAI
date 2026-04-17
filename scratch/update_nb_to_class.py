import json

def update_nb_to_class():
    path = "/home/dhruvvv_26/Desktop/KavachAI/ml/KavachAI_LSTM_Training_Phase3.ipynb"
    with open(path, 'r') as f:
        nb = json.load(f)

    for cell in nb['cells']:
        if cell['cell_type'] == 'code':
            source = "".join(cell['source'])
            source = source.replace("_label", "_class")
            cell['source'] = [line + ("\n" if not line.endswith("\n") else "") for line in source.split("\n")]
            if cell['source'][-1] == "\n": cell['source'].pop()

    with open(path, 'w') as f:
        json.dump(nb, f, indent=1)
    print("Notebook updated to use _class suffix.")

if __name__ == "__main__":
    update_nb_to_class()
