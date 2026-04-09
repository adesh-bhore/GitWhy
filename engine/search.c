#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_DIMS   768
#define MAX_DOCS   50000

typedef struct {
    int   index;
    float score;
} Result;

static int read_vector(float *vec, int dims) {
    for (int i = 0; i < dims; i++) {
        if (scanf("%f", &vec[i]) != 1) return 0;
    }
    return 1;
}


static float cosine_similarity(const float *a, const float *b, int dims) {
    float dot = 0.0f, na = 0.0f, nb = 0.0f;
    for (int i = 0; i < dims; i++) {
        dot += a[i] * b[i];
        na  += a[i] * a[i];
        nb  += b[i] * b[i];
    }
    if (na == 0.0f || nb == 0.0f) return 0.0f;
    return dot / (sqrtf(na) * sqrtf(nb));
}


/*
 * Maintain a sorted top-K list using insertion into a small fixed array.
 * K is typically 5-10 so an insertion sort outperforms a heap.
 */
static void insert_top_k(Result *heap, int *count, int k, int idx, float score) {
    if (*count < k) {
        heap[(*count)++] = (Result){ idx, score };
    } else if (score > heap[*count - 1].score) {
        heap[*count - 1] = (Result){ idx, score };
    } else {
        return;
    }
    /* Bubble the new entry up to maintain descending score order */
    for (int i = *count - 1; i > 0 && heap[i].score > heap[i-1].score; i--) {
        Result tmp = heap[i]; heap[i] = heap[i-1]; heap[i-1] = tmp;
    }
}

int main(int argc, char *argv[]) {
    int top_k = (argc > 1) ? atoi(argv[1]) : 5;
    int dims   = (argc > 2) ? atoi(argv[2]) : MAX_DIMS;

    float query[MAX_DIMS];
    float doc[MAX_DIMS];

    /* First line on stdin: the query vector */
    if (!read_vector(query, dims)) {
        fprintf(stderr, "error: failed to read query vector\n");
        return 1;
    }

    Result heap[100]; /* top_k never exceeds 100 in practice */
    int    count = 0;
    int    doc_index = 0;

    /* Remaining lines: one stored document vector per line */
    while (read_vector(doc, dims)) {
        float score = cosine_similarity(query, doc, dims);
        insert_top_k(heap, &count, top_k, doc_index, score);
        doc_index++;
    }

    /* Output: one result per line — "index score\n" */
    for (int i = 0; i < count; i++) {
        printf("%d %.6f\n", heap[i].index, heap[i].score);
    }

    return 0;
}