/* Shared glossary: every technical term on the ML / DL pages can be clicked to show its definition.
   - Manual: <a class="term" data-t="key">text</a>  (key optional: defaults to the text)
   - Automatic: the first mention of each glossary term in the page's prose is linked.
   Entries: [key, Term, 'alias|alias', 'definition (may use \( maths \))', 'site/path/#anchor' (optional)] */
(function(){
'use strict';
const E = [
/* ---------- data and the learning set-up ---------- */
['feature','Feature','features|input feature|input features','One measurable input to a model, such as a pixel, a word count or a house size. A data point is a vector of features \\(x=(x_1,\\dots,x_d)\\).'],
['label','Label','labels|target|class label|class labels','The answer we want the model to predict for a data point: a class (spam / not spam) or a number (price). Written \\(y\\).'],
['dataset','Dataset','datasets','A collection of examples, each a feature vector and (in supervised learning) its label.'],
['training-set','Training set','training data|training points|training examples|train set','The examples the model learns its parameters from. Doing well here is necessary but not enough: the goal is to do well on new data.'],
['test-set','Test set','test data|test points|held-out data|validation set','Examples kept aside and never used for training, so they give an honest estimate of performance on new data.'],
['supervised','Supervised learning','supervised','Learning from examples that come with the correct answer (labels). Classification and regression are both supervised.'],
['unsupervised','Unsupervised learning','unsupervised','Learning structure from data without labels, for example clustering or PCA.'],
['classification','Classification','classifier|classifiers|classify|binary classification','Predicting which of a fixed set of categories an example belongs to. A model that does this is a classifier.'],
['regression','Regression','regression problem','Predicting a continuous number, such as a price or a temperature, from features.'],
['decision-boundary','Decision boundary','decision boundaries|boundary','The line or surface where a classifier switches from predicting one class to the other. Shown as the bold line in the plots.'],
['linearly-separable','Linearly separable','linearly inseparable|not linearly separable','Two classes are linearly separable if a single straight line (a hyperplane in higher dimensions) can split them with no errors. XOR, circles and moons are not.'],
['hyperplane','Hyperplane','hyperplanes','A flat boundary one dimension lower than the space: a line in 2-D, a plane in 3-D. Written \\(w^\\top x+b=0\\).'],
['parameter','Parameter','parameters|weights|weight|learned parameters','A number inside the model that is learned from data, such as a weight \\(w_j\\) or a bias \\(b\\).'],
['hyperparameter','Hyperparameter','hyperparameters','A setting chosen by you, not learned from data: tree depth, learning rate, \\(C\\), \\(\\lambda\\), number of layers. Tuned with a validation set or cross-validation.'],
['bias-term','Bias (intercept)','intercept|bias term','The constant \\(b\\) (or \\(w_0\\)) added to a linear score so the line or hyperplane does not have to pass through the origin. Not the same as the bias in bias–variance.'],
['overfitting','Overfitting','overfit|overfits|over-fitting','When a model learns the noise in the training data as well as the pattern: training error is low but test error is high. Typical of models that are too flexible for the amount of data.','ml/linear-regression/#bv'],
['underfitting','Underfitting','underfit|underfits','When a model is too simple to capture the real pattern, so both training and test error are high.','ml/linear-regression/#bv'],
['generalisation','Generalisation','generalise|generalises|generalization|generalize','How well a model performs on new data it was not trained on. The real goal of learning.'],
['bias-variance','Bias–variance trade-off','bias-variance|bias–variance|bias and variance','Test error splits into bias (error from a model too simple to fit the truth), variance (error from sensitivity to the particular training sample) and noise. More flexible models lower bias but raise variance.','ml/linear-regression/#bv'],
['noise','Noise','noisy|label noise','Random variation in the data that no model can predict. Fitting it is overfitting.'],
['cross-validation','Cross-validation','k-fold|cross validation','Split the data into \\(k\\) parts, train on \\(k-1\\) and test on the remaining one, rotate, and average. A reliable way to choose hyperparameters.'],
['standardise','Standardise','standardised|standardize|standardized|standardisation|standardization|feature scaling','Rescale each feature to mean 0 and standard deviation 1: \\(z=(x-\\mu)/\\sigma\\). Needed for gradient descent, regularisation, SVMs, PCA and k-NN to treat features fairly.'],
['polynomial-features','Polynomial features','polynomial feature|feature map|basis expansion','New features made from powers and products of the originals (\\(x_1^2, x_1x_2, \\dots\\)). A linear model on them draws a curved boundary in the original space.'],

/* ---------- loss and optimisation ---------- */
['loss','Loss function','loss|losses|cost function|objective|objective function','A number measuring how wrong the model is on the data. Training means finding parameters that make it small.'],
['mse','Mean squared error','MSE|squared error|sum of squared errors|RSS|residual sum of squares','Average of squared differences between predictions and targets: \\(\\frac1n\\sum_i(y_i-\\hat y_i)^2\\). The loss of least squares.'],
['cross-entropy','Cross-entropy','log-loss|log loss|binary cross-entropy|BCE|negative log-likelihood','The loss for predicted probabilities: \\(-[y\\log p+(1-y)\\log(1-p)]\\). Very large when the model is confident and wrong.','ml/logistic-regression/#sig'],
['gradient','Gradient','gradients|\u2207','The vector of partial derivatives of the loss with respect to every parameter. It points in the direction the loss increases fastest, so we step the opposite way.'],
['gradient-descent','Gradient descent','GD|steepest descent','Repeatedly update parameters by a small step against the gradient: \\(\\theta\\leftarrow\\theta-\\eta\\nabla L(\\theta)\\).','dl/nn/optimisers/'],
['sgd','Stochastic gradient descent','SGD|stochastic','Gradient descent where each step uses the gradient on a small random subset (mini-batch) instead of the whole dataset: cheaper and noisier.','dl/nn/optimisers/#net'],
['learning-rate','Learning rate','step size|η|eta','How far each gradient step moves the parameters (\\(\\eta\\)). Too small: slow. Too large: oscillates or diverges.','dl/nn/optimisers/'],
['epoch','Epoch','epochs','One full pass of training over the whole dataset.'],
['iteration','Iteration','iterations|step|steps|update step','One parameter update. With mini-batches there are many iterations per epoch.'],
['mini-batch','Mini-batch','mini-batches|minibatch|batch size|batches','A small random group of training examples used for one gradient step.'],
['convex','Convex','convexity|convex function|convex problem|non-convex','A bowl-shaped function: any local minimum is the global minimum, so gradient descent cannot get stuck. Linear, logistic regression and SVMs are convex; neural networks are not.'],
['local-minimum','Local minimum','local minima|global minimum|global minima|minimum|minima','A point where the loss is lower than everywhere nearby. The global minimum is the lowest point overall.'],
['saddle-point','Saddle point','saddle points|saddle','A point where the gradient is zero but the surface curves up in some directions and down in others, like a horse saddle. Common in high-dimensional loss surfaces.','dl/nn/optimisers/#race'],
['hessian','Hessian','Hessian matrix|second derivative|curvature','The matrix of second derivatives of the loss. It describes the curvature of the surface and is what Newton\u2019s method uses.'],
['newton','Newton\u2019s method','Newton|Newton method|IRLS|Newton-Raphson','An optimiser that uses curvature: \\(\\theta\\leftarrow\\theta-H^{-1}\\nabla L\\). Converges in a handful of steps on smooth convex problems, but each step is expensive.','ml/logistic-regression/#maths'],
['condition-number','Condition number','ill-conditioned|ill conditioned|conditioning','The ratio of largest to smallest curvature, \\(\\kappa=\\lambda_{\\max}/\\lambda_{\\min}\\). A large \\(\\kappa\\) means a long narrow valley where gradient descent zig-zags.','dl/nn/optimisers/#race'],
['closed-form','Closed form','closed-form|analytic solution|exact solution','A solution you can write down as a formula and compute directly, without iterating.'],
['coordinate-descent','Coordinate descent','cyclic coordinate descent','Optimise one parameter at a time, holding the others fixed, and cycle. The standard way to fit the lasso.'],
['proximal','Proximal gradient descent','proximal gradient|prox|ISTA','For a loss = smooth part + non-smooth penalty: take a gradient step on the smooth part, then apply the penalty\u2019s proximal operator (for L1, soft-thresholding).','ml/regularisation/#prox'],
['soft-threshold','Soft-thresholding','soft threshold|soft-threshold|shrinkage operator','\\(S_t(w)=\\operatorname{sign}(w)\\max(0,|w|-t)\\): shrink towards zero by \\(t\\) and set to exactly zero if within \\(t\\). It is why L1 gives sparse solutions.','ml/regularisation/#prox'],

/* ---------- regularisation ---------- */
['regularisation','Regularisation','regularization|regularise|regularised|regularize|regularized|regulariser|penalty','Adding a penalty for complexity to the loss, \\(L(w)+\\lambda R(w)\\), so the model prefers simpler solutions and overfits less.','ml/regularisation/'],
['l1','L1 regularisation','L1|L1 penalty|L1 norm|lasso penalty|\u2113\u2081','Penalty \\(\\lambda\\sum_j|w_j|\\). Pushes many weights to exactly zero (sparse model), which also selects features.','ml/regularisation/'],
['l2','L2 regularisation','L2|L2 penalty|L2 norm|ridge penalty|\u2113\u2082','Penalty \\(\\tfrac\\lambda2\\sum_j w_j^2\\). Shrinks all weights smoothly towards zero but rarely to exactly zero.','ml/regularisation/'],
['ridge','Ridge regression','ridge|Tikhonov','Least squares plus an L2 penalty: \\(w=(X^\\top X+\\lambda I)^{-1}X^\\top y\\).','ml/linear-regression/#shrink'],
['lasso','Lasso','LASSO|lasso regression','Least squares plus an L1 penalty. Sets some coefficients exactly to zero.','ml/linear-regression/#shrink'],
['elastic-net','Elastic net','elastic-net','A mix of L1 and L2 penalties: sparse like the lasso, stable with correlated features like ridge.','ml/regularisation/'],
['weight-decay','Weight decay','AdamW|decoupled weight decay','Shrinking every weight by a small factor each step; for plain gradient descent it equals L2 regularisation. AdamW applies it separately from Adam\u2019s rescaling.','ml/regularisation/#nn'],
['sparse','Sparse','sparsity|sparse model|sparse solution','Having most entries exactly zero. A sparse model uses only a few features.'],
['shrinkage','Shrinkage','shrink|shrinks|shrunk','Pulling estimates towards zero (or towards a simple target) to reduce variance at the cost of a little bias.'],
['regularisation-path','Regularisation path','regularization path|coefficient path|lasso path','How each fitted coefficient changes as the penalty strength \\(\\lambda\\) goes from large to small.','ml/regularisation/#path'],
['early-stopping','Early stopping','stop early','Stop training when validation error starts rising. Acts as a regulariser.'],
['dropout','Dropout','dropout layer','Randomly zero a fraction of neurons at each training step so the network cannot rely on any single one. A regulariser for neural networks.'],

/* ---------- probability and statistics ---------- */
['mean','Mean','average|expected value|expectation','The average value \\(\\mu=\\frac1n\\sum_i x_i\\).'],
['variance','Variance','standard deviation','How spread out values are around their mean: \\(\\sigma^2=\\frac1n\\sum_i(x_i-\\mu)^2\\). The standard deviation \\(\\sigma\\) is its square root.'],
['covariance','Covariance matrix','covariance|covariances|Σ','A \\(d\\times d\\) matrix whose \\((j,k)\\) entry is how features \\(j\\) and \\(k\\) vary together. Its diagonal holds the variances. It sets the shape and tilt of a Gaussian\u2019s ellipses.'],
['gaussian','Gaussian distribution','Gaussian|normal distribution|Gaussians|bell curve|multivariate normal','The bell-shaped distribution \\(\\mathcal N(\\mu,\\Sigma)\\). In 2-D its contours are ellipses.'],
['laplace','Laplace distribution','Laplace prior|Laplace','A distribution with a sharp peak at its centre, \\(p(w)\\propto e^{-|w|/b}\\). As a prior on weights it gives L1 regularisation.','ml/regularisation/#bayes'],
['probability','Probability','probabilities','A number from 0 to 1 saying how likely something is.','math/probability/'],
['likelihood','Likelihood','likelihood function','How probable the observed data is under given parameters, \\(p(\\text{data}\\mid\\theta)\\). Maximum likelihood picks the parameters that make the data most probable.','math/mle/#lik'],
['prior','Prior','priors|prior distribution|class prior','What you believe before seeing the data. For classes: \\(\\pi_k=P(y=k)\\). For weights: \\(p(w)\\), e.g. Gaussian (gives L2) or Laplace (gives L1).','math/probability/#bayes'],
['posterior','Posterior','posterior probability|posteriors','Belief after seeing the data: \\(P(y=k\\mid x)\\), or \\(p(w\\mid\\text{data})\\). Bayes\u2019 rule combines prior and likelihood into it.','math/bayesian/#update'],
['bayes-rule','Bayes\u2019 rule','Bayes rule|Bayes\u2019 theorem|Bayes theorem','\\(P(A\\mid B)=P(B\\mid A)P(A)/P(B)\\): turns a likelihood and a prior into a posterior.','math/probability/#bayes'],
['map','MAP estimate','MAP|maximum a posteriori','The parameters with the highest posterior probability. With a Gaussian prior it is ridge / L2; with a Laplace prior it is the lasso / L1.','ml/regularisation/#bayes'],
['generative','Generative model','generative|generative classifier','Models how each class generates data, \\(p(x\\mid y)\\) and \\(p(y)\\), then uses Bayes\u2019 rule. LDA, QDA and naive Bayes are generative.'],
['discriminative','Discriminative model','discriminative|discriminative classifier','Models \\(p(y\\mid x)\\) or the boundary directly, without modelling how \\(x\\) is generated. Logistic regression and SVMs are discriminative.'],
['outlier','Outlier','outliers','A data point far from the rest. Squared-error losses are pulled strongly by outliers.'],

/* ---------- linear algebra ---------- */
['vector','Vector','vectors','An ordered list of numbers, like a point or arrow in space.','math/vectors/'],
['matrix','Matrix','matrices','A rectangular table of numbers. Multiplying a vector by a matrix applies a linear transformation (rotate, stretch, project).','math/matrices/'],
['dot-product','Dot product','inner product|dot products','\\(a\\cdot b=\\sum_j a_jb_j\\). Large when the vectors point the same way; zero when they are perpendicular.','math/vectors/#dot'],
['eigenvector','Eigenvector','eigenvectors|eigenvalue|eigenvalues|eigen-decomposition|eigendecomposition','A direction \\(v\\) that a matrix only stretches: \\(Av=\\lambda v\\). The stretch \\(\\lambda\\) is the eigenvalue. PCA uses the eigenvectors of the covariance matrix.','math/decompositions/#eigen'],
['projection','Projection','project|projected|projecting|projections','Mapping a point onto a line or subspace by dropping the part that sticks out of it, like a shadow.','math/projections/'],
['norm','Norm','‖w‖|vector norm','The length of a vector. The L2 norm is \\(\\sqrt{\\sum w_j^2}\\), the L1 norm is \\(\\sum|w_j|\\).','math/vectors/#norms'],
['normal-equations','Normal equations','normal equation','\\(X^\\top X w=X^\\top y\\): the condition the least-squares solution satisfies (the residual is perpendicular to every feature column).','ml/linear-regression/#maths'],
['jacobian','Jacobian','Jacobians','The matrix of all partial derivatives of a vector-valued function. Backpropagation multiplies Jacobians layer by layer.'],

/* ---------- linear and logistic regression ---------- */
['least-squares','Least squares','ordinary least squares|OLS','Fit a model by minimising the sum of squared errors. For a linear model the answer is \\(w=(X^\\top X)^{-1}X^\\top y\\).','ml/linear-regression/'],
['residual-reg','Residual (regression)','residuals','The error of one prediction, \\(e_i=y_i-\\hat y_i\\). Not the same as a residual connection.','ml/linear-regression/'],
['coefficient','Coefficient','coefficients','The weight multiplying a feature in a linear model. Its sign and size say how the prediction changes with that feature.'],
['r2','R²','R2|R-squared|coefficient of determination','The share of the target\u2019s variance explained by the model: \\(1-\\text{RSS}/\\text{TSS}\\). 1 is a perfect fit, 0 is no better than predicting the mean.'],
['linear-model','Linear model','linear models|linear classifier|linear score','A model whose output is a weighted sum of features, \\(w^\\top x+b\\). Its decision boundary is a straight line or hyperplane.'],
['sigmoid','Sigmoid','logistic function|σ(z)|sigmoid function','\\(\\sigma(z)=1/(1+e^{-z})\\). Squashes any number into \\((0,1)\\), so it can be read as a probability.','ml/logistic-regression/#sig'],
['logit','Logit','log-odds|log odds|logits','The score before the sigmoid or softmax. For a probability \\(p\\), \\(\\log\\frac{p}{1-p}\\).'],
['softmax','Softmax','softmax function','Turns a vector of scores into probabilities that sum to 1: \\(\\operatorname{softmax}(z)_i=e^{z_i}/\\sum_j e^{z_j}\\). Used for multi-class outputs and inside attention.','dl/nlp/attention/'],
['threshold','Threshold','decision threshold|cut-off','The probability above which a classifier says "class 1". 0.5 by default; moving it trades precision against recall.','ml/logistic-regression/#thr'],
['accuracy','Accuracy','training accuracy|test accuracy','Fraction of examples classified correctly. Misleading when one class is rare.'],
['confusion-matrix','Confusion matrix','true positive|true positives|false positive|false positives|true negative|false negative|false negatives','A 2\u00d72 table counting true positives, false positives, true negatives and false negatives.','ml/logistic-regression/#thr'],
['precision','Precision','sensitivity|specificity','Precision: of the predicted positives, how many are right. Recall: of the real positives, how many were found. F1 is their harmonic mean.','ml/logistic-regression/#thr'],
['roc','ROC curve','ROC|AUC|area under the curve','Plots true-positive rate against false-positive rate as the threshold moves. AUC (area under it) is 1 for perfect ranking, 0.5 for random.','ml/logistic-regression/#thr'],

/* ---------- LDA / GDA ---------- */
['lda','LDA','linear discriminant analysis|Fisher','Linear discriminant analysis: model each class as a Gaussian with a shared covariance. The boundary is linear. Also Fisher\u2019s projection that best separates class means.','ml/lda-gda/'],
['qda','QDA','quadratic discriminant analysis','Each class gets its own Gaussian covariance, so the boundary is quadratic (curved).','ml/lda-gda/'],
['gda','GDA','Gaussian discriminant analysis','The family of generative classifiers that model each class as a Gaussian: LDA, QDA and Gaussian naive Bayes.','ml/lda-gda/'],
['naive-bayes','Naive Bayes','naive Bayes|Gaussian naive Bayes|Gaussian NB','Assumes features are independent within each class (diagonal covariance). Crude but fast, and often surprisingly good.','ml/lda-gda/'],
['discriminant','Discriminant function','discriminant|discriminants|δ_k','A score \\(\\delta_k(x)\\) per class; predict the class with the largest score.'],

/* ---------- SVM ---------- */
['svm','Support vector machine','SVM|SVMs|support vector machines','A classifier that finds the boundary with the widest margin; with kernels it draws non-linear boundaries.','ml/svm/'],
['margin','Margin','margins|maximum margin|max-margin','The gap between the decision boundary and the nearest training points. An SVM maximises it: width \\(2/\\lVert w\\rVert\\).','ml/svm/'],
['support-vector','Support vectors','support vector|SVs','The training points on or inside the margin (\\(\\alpha_i>0\\)). Only they determine the SVM boundary; the rest could be deleted.','ml/svm/#sv'],
['hinge','Hinge loss','hinge','\\(\\max(0,1-y\\,f(x))\\): zero for points safely beyond the margin, rising linearly otherwise. The SVM\u2019s loss.'],
['slack','Slack variable','slack|slack variables|ξ','\\(\\xi_i\\ge0\\): how far point \\(i\\) violates the margin in a soft-margin SVM. \\(C\\) sets their price.','ml/svm/#maths'],
['soft-margin','Soft margin','soft-margin|hard margin|hard-margin','A hard margin allows no errors; a soft margin lets some points cross, at cost \\(C\\) each. Small \\(C\\) = wider margin, more regularisation.','ml/svm/#maths'],
['kernel','Kernel','kernels|kernel function','A similarity \\(k(x,x\')\\) equal to a dot product in some feature space. Lets linear methods draw non-linear boundaries.','ml/svm/#trick'],
['kernel-trick','Kernel trick','kernel-trick','Replace every dot product \\(x^\\top x\'\\) by \\(k(x,x\')\\), which works in a high (even infinite) dimensional space without ever computing it.','ml/svm/#trick'],
['rbf','RBF kernel','RBF|Gaussian kernel|radial basis function','\\(k(x,x\')=\\exp(-\\gamma\\lVert x-x\'\\rVert^2)\\): similarity that decays with distance. Large \\(\\gamma\\) = very local, wiggly boundaries.','ml/svm/'],
['dual','Dual problem','dual|dual form|Lagrangian dual','A rewrite of the optimisation in terms of one multiplier \\(\\alpha_i\\) per training point. For SVMs it only needs dot products, which enables kernels.','ml/svm/#maths'],
['lagrange','Lagrange multiplier','Lagrange multipliers|Lagrangian|α_i','An extra variable that enforces a constraint inside an optimisation. In SVMs, \\(\\alpha_i>0\\) marks a support vector.'],
['kkt','KKT conditions','KKT|Karush-Kuhn-Tucker','The optimality conditions for constrained problems. For SVMs they say which points are on, inside or outside the margin.','ml/svm/#sv'],
['smo','SMO','sequential minimal optimisation|sequential minimal optimization','The classic SVM solver: repeatedly pick two multipliers \\(\\alpha_i,\\alpha_j\\) and optimise them exactly, holding the rest fixed.'],

/* ---------- trees and ensembles ---------- */
['decision-tree','Decision tree','decision trees|tree|trees|CART','A model that asks a sequence of yes/no questions about features ("is \\(x_1<0.3\\)?") and predicts from the leaf it ends in.','ml/decision-trees/'],
['node','Node','nodes|root|root node|internal node','A question in a decision tree. The root is the first question.'],
['leaf','Leaf','leaves|leaf node','An end point of a tree, holding a prediction (the majority class of its training points).'],
['split','Split','splits|splitting|threshold split','A question \\(x_j<t\\) that divides a node\u2019s points into two children. Chosen to reduce impurity the most.','ml/decision-trees/#split'],
['impurity','Impurity','impure|pure','How mixed the classes in a node are. 0 for a pure node (one class).','ml/decision-trees/#maths'],
['gini','Gini impurity','Gini','\\(1-\\sum_k p_k^2\\): the chance two random points from the node have different classes.','ml/decision-trees/#maths'],
['entropy','Entropy','information gain|information','\\(-\\sum_k p_k\\log_2 p_k\\): the uncertainty of the class in a node, in bits. Information gain is the drop in entropy from a split.','ml/decision-trees/#maths'],
['max-depth','Max depth','depth|tree depth','The longest chain of questions allowed in a tree. Deeper trees fit more detail and overfit more.'],
['pruning','Pruning','prune|cost-complexity pruning|ccp_alpha','Cutting back branches that do not help on validation data. Cost-complexity pruning adds a penalty \\(\\alpha\\times\\) number of leaves: the tree version of regularisation.'],
['ensemble','Ensemble','ensembles|ensemble method','Many models combined by voting or averaging. Usually more accurate than any single member.','ml/ensembles/'],
['bagging','Bagging','bootstrap aggregating','Train each model on a different bootstrap sample and average their votes. Reduces variance.','ml/ensembles/#rf'],
['bootstrap','Bootstrap','bootstrap sample|bootstrap samples|resampling','A sample of \\(n\\) points drawn with replacement from \\(n\\): some points appear several times, about 37% not at all.','ml/ensembles/#rf'],
['random-forest','Random forest','random forests|RF','Bagging of decision trees, plus a random subset of features at each split so the trees disagree more.','ml/ensembles/#rf'],
['oob','Out-of-bag','OOB|out-of-bag error','The ~37% of points a bootstrap sample left out. Testing each tree on them gives a free validation estimate.','ml/ensembles/#rf'],
['boosting','Boosting','boosted','Train models one after another, each focusing on the examples the previous ones got wrong, then combine them with weights. Reduces bias.','ml/ensembles/#ada'],
['adaboost','AdaBoost','Adaboost|adaptive boosting','Boosting that re-weights misclassified points up after each round and gives each weak learner a vote \\(\\alpha=\\tfrac12\\ln\\frac{1-\\varepsilon}{\\varepsilon}\\).','ml/ensembles/#ada'],
['weak-learner','Weak learner','weak learners|weak classifier','A model only slightly better than guessing, like a one-split tree.'],
['stump','Decision stump','stump|stumps|decision stumps','A tree with a single split: the usual weak learner in AdaBoost.'],
['gradient-boosting','Gradient boosting','XGBoost|LightGBM|GBM','Boosting where each new tree fits the gradient of the loss (the residuals). XGBoost adds L1 and L2 penalties on leaf values.'],

/* ---------- PCA ---------- */
['pca','PCA','principal component analysis','Finds the directions of greatest variance in data and re-expresses the data along them. Used to compress, denoise and visualise.','ml/pca/'],
['principal-component','Principal component','principal components|PC1|PC2|PCs','A direction of maximum remaining variance; the eigenvectors of the covariance matrix, ordered by eigenvalue.','ml/pca/'],
['explained-variance','Explained variance','variance explained|explained variance ratio','The share of total variance captured by a principal component: its eigenvalue divided by the sum of all eigenvalues.','ml/pca/'],
['scree','Scree plot','scree','A bar chart of eigenvalues (or explained variance) by component, used to choose how many components to keep.','ml/pca/'],
['dimensionality-reduction','Dimensionality reduction','reduce dimensions|lower-dimensional','Representing data with fewer features while keeping most of the information.'],
['reconstruction','Reconstruction','reconstruct|reconstructed|reconstruction error','Mapping compressed data back to the original space. The error left over measures what was lost.'],

/* ---------- neural networks ---------- */
['neuron','Neuron','neurons|unit|units|perceptron|perceptrons','Computes a weighted sum of its inputs plus a bias and passes it through an activation: \\(a=\\phi(w^\\top x+b)\\).','dl/nn/neural-networks/'],
['activation','Activation function','activation|activations|non-linearity|non-linearities|nonlinearity|φ','The non-linear function \\(\\phi\\) applied after each weighted sum (ReLU, tanh, sigmoid, GELU). Without it, any stack of layers is just one linear map.','dl/nn/activations/'],
['layer','Layer','layers|hidden layer|hidden layers|output layer|input layer','A group of neurons that all read the same inputs. Hidden layers sit between input and output.','dl/nn/neural-networks/'],
['mlp','Multilayer perceptron','MLP|MLPs|feed-forward network|feedforward network|fully connected|dense layer|dense layers','A neural network of stacked fully connected layers with activations in between.','dl/nn/neural-networks/'],
['neural-network','Neural network','neural networks|network|networks|deep network|deep networks|deep learning','A function built from layers of neurons, trained end to end by backpropagation and gradient descent.','dl/nn/neural-networks/'],
['xor','XOR','exclusive or','"Exclusive or": output 1 when exactly one input is 1. Not linearly separable, so a single neuron cannot learn it but one hidden layer can.','dl/nn/neural-networks/'],
['forward-pass','Forward pass','forward propagation|forward','Computing the network\u2019s output from its input, layer by layer.'],
['backprop','Backpropagation','backprop|backward pass|back-propagation','Computing the gradient of the loss for every weight by applying the chain rule backwards from the output, reusing the forward pass\u2019s intermediate values.','dl/nn/neural-networks/#backprop'],
['chain-rule','Chain rule','chain-rule','\\(\\frac{d}{dx}f(g(x))=f\'(g(x))\\,g\'(x)\\). Backpropagation is the chain rule applied through every layer.'],
['vanishing-gradient','Vanishing gradients','vanishing gradient|exploding gradients|exploding gradient|vanish|vanishes','In deep or recurrent networks the gradient is a product of many factors; if they are below 1 it shrinks to nothing (vanishing), above 1 it blows up (exploding).','dl/nn/activations/#vanish'],
['relu','ReLU','rectified linear unit|ReLUs','\\(\\max(0,x)\\). Cheap, does not saturate for positive inputs; the default hidden activation.','dl/nn/activations/'],
['leaky-relu','Leaky ReLU','leaky','\\(\\max(\\alpha x,x)\\) with small \\(\\alpha\\) (0.01 to 0.1): keeps a small slope for negative inputs so neurons cannot die.','dl/nn/activations/#dead'],
['tanh','tanh','hyperbolic tangent','\\(\\tanh(x)\\in(-1,1)\\): an S-shaped curve centred on zero. Used in RNNs and LSTMs.','dl/nn/activations/'],
['gelu','GELU','Gaussian error linear unit','\\(x\\,\\Phi(x)\\): a smooth ReLU used in BERT and GPT.','dl/nn/activations/'],
['swish','Swish','SiLU|SwiGLU','\\(x\\,\\sigma(x)\\): smooth, slightly non-monotone. SwiGLU (a gated version) is used in LLaMA-style models.','dl/nn/activations/'],
['elu','ELU','exponential linear unit','\\(x\\) for \\(x>0\\), \\(e^x-1\\) otherwise: smooth, with negative outputs that keep the mean near zero.','dl/nn/activations/'],
['dead-relu','Dead ReLU','dead neurons|dead neuron|dying ReLU','A ReLU neuron whose input is negative for every example, so it outputs 0 and gets zero gradient forever.','dl/nn/activations/#dead'],
['saturation','Saturation','saturate|saturates|saturated|saturating','When a sigmoid or tanh is pushed far into its flat tails, its slope is near 0 and almost no gradient passes through.','dl/nn/normalisation/#depth'],
['initialisation','Initialisation','initialization|init|Xavier|He initialisation|Glorot|He init','How weights are set before training. Xavier/Glorot (\\(\\sigma^2=1/n_{in}\\)) suits tanh; He (\\(\\sigma^2=2/n_{in}\\)) suits ReLU. Keeps signals from shrinking or exploding at the start.','dl/nn/normalisation/#depth'],
['momentum','Momentum','heavy ball','An optimiser that keeps a running velocity of past gradients, speeding up along consistent directions and damping zig-zags.','dl/nn/optimisers/#rules'],
['nesterov','Nesterov momentum','Nesterov|NAG','Momentum that evaluates the correction at the look-ahead point. Less overshoot.','dl/nn/optimisers/#rules'],
['adagrad','AdaGrad','Adagrad','Divides each parameter\u2019s step by the root of its accumulated squared gradients: big steps for rare features, but learning eventually stalls.','dl/nn/optimisers/#rules'],
['rmsprop','RMSProp','RMSprop','Divides each step by a running RMS of recent gradients, so every parameter moves at a similar rate.','dl/nn/optimisers/#rules'],
['adam','Adam','ADAM','Momentum + RMSProp with bias correction. The default optimiser for most deep learning.','dl/nn/optimisers/#rules'],
['lr-schedule','Learning-rate schedule','learning rate schedule|schedule|schedules|warm-up|warmup|cosine decay|step decay','Changing the learning rate during training: warm up from small, then decay (step or cosine) to settle into a minimum.','dl/nn/optimisers/#sched'],
['residual','Residual connection','residual connections|skip connection|skip connections|shortcut|ResNet|ResNets|residual block|residual blocks','Adds a block\u2019s input to its output, \\(x+F(x)\\). Gradients get a direct path and blocks only learn changes, so very deep networks train.','dl/nn/residual/'],
['identity','Identity mapping','identity|identity map|identity function','The function that returns its input unchanged. A residual block becomes one when \\(F=0\\).'],
['degradation','Degradation problem','degradation','Deeper plain networks reaching higher <i>training</i> error than shallower ones: an optimisation failure, fixed by residual connections.','dl/nn/residual/'],
['normalisation','Normalisation layer','normalisation|normalization|normalise|normalised|normalize|normalized','A layer that re-centres and re-scales activations to mean 0, variance 1 (then learnable \\(\\gamma,\\beta\\)), keeping every layer\u2019s inputs in range.','dl/nn/normalisation/'],
['batchnorm','BatchNorm','batch normalisation|batch normalization|BN','Normalise each feature using its mean and variance across the mini-batch; uses running averages at test time.','dl/nn/normalisation/'],
['layernorm','LayerNorm','layer normalisation|layer normalization|LN|pre-LN|post-LN','Normalise each example across its own features. Independent of the batch; used in transformers.','dl/nn/normalisation/'],
['rmsnorm','RMSNorm','RMS norm','LayerNorm without subtracting the mean: divide by the root-mean-square. Used in LLaMA and most recent LLMs.','dl/nn/normalisation/'],
['running-average','Running average','running averages|moving average|exponential moving average|EMA|running mean|running stats','An average updated a little at each step, \\(m\\leftarrow0.9m+0.1x\\), that tracks recent values.'],
['pytorch','PyTorch','torch','A popular Python deep-learning library. The code boxes show how each idea is written in it.'],
['scikit-learn','scikit-learn','sklearn','The standard Python library for traditional machine learning. The code boxes show the matching calls.'],

/* ---------- NLP ---------- */
['token','Token','tokens','The unit a language model reads: a word, a piece of a word, a character or a byte, each mapped to an integer id.','dl/nlp/tokenisation/'],
['tokenisation','Tokenisation','tokenization|tokeniser|tokenizer|tokenise|tokenize|tokenised','Splitting text into tokens and mapping each to an id from a fixed vocabulary.','dl/nlp/tokenisation/'],
['vocabulary','Vocabulary','vocab|vocabulary size','The fixed list of all tokens a model knows. Typical sizes: 30k (BERT) to 100k+ (recent LLMs).','dl/nlp/tokenisation/'],
['subword','Subword','subwords|subword tokenisation|subword units','A piece of a word (like "un", "believ", "able"). Subword vocabularies handle rare and new words by combining pieces.','dl/nlp/tokenisation/'],
['bpe','BPE','byte-pair encoding|byte pair encoding|byte-level BPE','Start from characters (or bytes) and repeatedly merge the most frequent adjacent pair into a new token. Used by GPT models.','dl/nlp/tokenisation/#bpe'],
['wordpiece','WordPiece','word piece|##','A subword method like BPE that picks merges by likelihood gain; continuation pieces are marked "##". Used by BERT.','dl/nlp/tokenisation/#wordpiece'],
['oov','Out-of-vocabulary','OOV|unknown word|[UNK]|UNK','A word not in the vocabulary. Word-level tokenisers map it to [UNK]; subword tokenisers split it into known pieces.','dl/nlp/tokenisation/'],
['embedding','Embedding','embeddings|word embedding|word embeddings|word vector|word vectors|dense vector','A learned dense vector representing a token or word, placed so that similar meanings are close together.','dl/nlp/embeddings/'],
['one-hot','One-hot encoding','one-hot|one hot','A vector of zeros with a single 1 at the word\u2019s index. As long as the vocabulary, and every pair of words is equally far apart.','dl/nlp/embeddings/'],
['bag-of-words','Bag of words','BoW|bag-of-words|count vector','Represent a document by how often each vocabulary word appears, ignoring order.','dl/nlp/embeddings/'],
['tf-idf','TF-IDF','tf–idf|tfidf|term frequency|inverse document frequency','Word count in a document times \\(\\log\\frac{N}{\\text{number of documents containing the word}}\\): common words everywhere get down-weighted.','dl/nlp/embeddings/'],
['word2vec','word2vec','skip-gram|CBOW|skipgram','Learns word embeddings by predicting a word\u2019s neighbours (skip-gram) or a word from its neighbours (CBOW). Gives the famous king \u2212 man + woman \u2248 queen.','word2vec/'],
['cosine','Cosine similarity','cosine|cos similarity','\\(\\cos\\theta=\\frac{a\\cdot b}{\\lVert a\\rVert\\lVert b\\rVert}\\): 1 for the same direction, 0 for unrelated, \u22121 for opposite.','dl/nlp/embeddings/'],
['contextual','Contextual embedding','contextual embeddings|contextual|ELMo','An embedding that depends on the surrounding sentence, so "bank" gets different vectors in "river bank" and "bank loan".','dl/nlp/embeddings/#context'],
['bert','BERT','RoBERTa','A transformer encoder pre-trained to fill in masked words using context on both sides. Gives contextual embeddings for classification, search and tagging.','dl/nlp/transformers/'],
['gpt','GPT','GPT-2|GPT-3|GPT-4|LLaMA|Llama|Mistral','Decoder-only transformers trained to predict the next token. The basis of modern chat models.','dl/nlp/transformers/'],
['llm','Large language model','LLM|LLMs|large language models|language model|language models','A very large neural network (usually a transformer) trained to predict text, then adapted to follow instructions.'],
['rnn','RNN','recurrent neural network|recurrent neural networks|RNNs|recurrent','A network that reads a sequence one step at a time, carrying a hidden state forward: \\(h_t=\\tanh(W_hh_{t-1}+W_xx_t+b)\\).','dl/nlp/rnn/'],
['hidden-state','Hidden state','hidden states|h_t','The vector an RNN carries from step to step: its running summary of everything read so far.','dl/nlp/rnn/'],
['bptt','Backpropagation through time','BPTT','Backpropagation on the RNN unrolled over all time steps. Gradients multiply through every step, so they vanish or explode.','dl/nlp/rnn/#bptt'],
['lstm','LSTM','long short-term memory|LSTMs','An RNN with a separate cell state and gates (forget, input, output) that decide what to keep, write and read, so information and gradients survive long sequences.','dl/nlp/memory/'],
['gru','GRU','gated recurrent unit|GRUs','A simpler gated RNN with an update and a reset gate and no separate cell state.','dl/nlp/memory/'],
['gate','Gate','gates|gating|forget gate|input gate|output gate|update gate|reset gate','A sigmoid-valued vector in \\((0,1)\\) that multiplies another vector element-wise, acting as a soft on/off switch.','dl/nlp/memory/'],
['cell-state','Cell state','c_t|memory cell','The LSTM\u2019s long-term memory, updated mostly by addition, which lets gradients flow far back (like a residual connection through time).','dl/nlp/memory/'],
['seq2seq','Seq2seq','sequence-to-sequence|encoder-decoder|encoder–decoder','A model that reads an input sequence with an encoder and writes an output sequence with a decoder, as in translation.','dl/nlp/attention/'],
['encoder','Encoder','encoders','The part of a model that reads the input and turns it into vectors.','dl/nlp/transformers/'],
['decoder','Decoder','decoders|decoder-only','The part of a model that generates the output one token at a time. Decoder-only models (GPT) have no separate encoder.','dl/nlp/transformers/'],
['attention','Attention','attention mechanism|attend|attends|attention weights|attention scores','Each position builds its output as a weighted average of other positions\u2019 values, with weights from how well its query matches their keys.','dl/nlp/attention/'],
['qkv','Query, key, value','query|queries|key|keys|value|values|Q, K, V|Q/K/V','Three learned projections of each token: the query asks "what am I looking for?", keys answer "what do I contain?", values are what gets passed on.','dl/nlp/self-attention/'],
['scaled-dot','Scaled dot-product attention','scaled dot-product|dot-product attention','\\(\\operatorname{softmax}(QK^\\top/\\sqrt{d_k})V\\). Dividing by \\(\\sqrt{d_k}\\) keeps the scores from growing with dimension and saturating the softmax.','dl/nlp/self-attention/'],
['self-attention','Self-attention','self attention','Attention where queries, keys and values all come from the same sequence, so every token can look at every other token.','dl/nlp/self-attention/'],
['cross-attention','Cross-attention','cross attention|encoder-decoder attention','Attention where queries come from one sequence (the decoder) and keys and values from another (the encoder, or image patches).','dl/nlp/cross-attention/'],
['multi-head','Multi-head attention','multi-head|heads|head|attention heads','Run several attention operations in parallel with different projections, so different heads can track different relations, then concatenate.','dl/nlp/self-attention/#heads'],
['causal-mask','Causal mask','causal|masking|mask|look-ahead mask','Blocks each position from attending to later positions, so a model generating text cannot peek at the future.','dl/nlp/self-attention/#mask'],
['positional-encoding','Positional encoding','positional encodings|position embedding|position embeddings|RoPE|rotary','Information about each token\u2019s position added to (or rotated into) its embedding, since attention by itself ignores order.','dl/nlp/transformers/#pos'],
['transformer','Transformer','transformers','An architecture built from self-attention and feed-forward layers with residual connections and LayerNorm. The basis of BERT, GPT and most modern AI.','dl/nlp/transformers/'],
['residual-stream','Residual stream','residual-stream','The vector for each token that flows through a transformer\u2019s residual connections; every attention and MLP sub-block reads it and adds to it.','dl/nlp/transformers/'],
['autoregressive','Autoregressive','autoregression|next-token prediction|next token','Generating one token at a time, each conditioned on all previous ones.','dl/nlp/transformers/#decode'],
['temperature','Temperature','sampling temperature','Divides logits before the softmax: below 1 makes the output more confident and repetitive, above 1 more random.','dl/nlp/transformers/#decode'],
['greedy','Greedy decoding','greedy|beam search|top-k|top-p|nucleus sampling','Ways to pick the next token: greedy takes the most likely, beam search keeps several candidates, top-k / top-p sample from the most likely few.','dl/nlp/transformers/#decode'],
['perplexity','Perplexity','PPL','\\(\\exp\\) of the average cross-entropy per token: roughly how many choices the model is torn between. Lower is better.'],
['pretraining','Pre-training','pretraining|pre-trained|pretrained','Training a large model on huge unlabelled text with a self-supervised goal (next token, masked word) before adapting it.'],
['fine-tuning','Fine-tuning','fine-tune|fine-tuned|finetuning','Continuing training of a pre-trained model on a smaller task-specific dataset.'],
['mlm','Masked language modelling','masked language model|MLM|[MASK]','Hide some tokens and train the model to predict them from both sides of context. BERT\u2019s pre-training task.','dl/nlp/transformers/'],
/* ---------- retrieval-augmented generation ---------- */
['rag','Retrieval-augmented generation','RAG|retrieval augmented generation|retrieval-augmented','A language model that first fetches relevant passages from a document store and then writes its answer conditioned on them, so its knowledge can be updated or cited without retraining.','dl/nlp/rag/#intro'],
['retriever','Retriever','retrievers|retrieval|retrieve|retrieved','The search component of RAG: given a question, return the \\(k\\) passages most likely to help answer it.','dl/nlp/rag/#retrieval'],
['sparse-retrieval','Sparse retrieval','sparse retriever|lexical search|keyword search','Search over high-dimensional, mostly-zero vectors of word counts (TF-IDF, BM25). Matches exact words only, but is fast, cheap and transparent.','dl/nlp/rag/#retrieval'],
['dense-retrieval','Dense retrieval','dense retriever|semantic search|vector search','Search with learned embeddings: query and passages become short dense vectors and relevance is their dot product or cosine, so synonyms and paraphrases match.','dl/nlp/rag/#retrieval'],
['bm25','BM25','Okapi BM25|best matching 25','The standard sparse ranking function: sums, over query words, IDF \\(\\times\\) a saturating term frequency, normalised for document length. Parameters \\(k_1\\) (saturation) and \\(b\\) (length).','dl/nlp/rag/#retrieval'],
['idf','Inverse document frequency','IDF','\\(\\log\\) of how rare a word is across the collection: rare words are informative, words in every document are not.','dl/nlp/rag/#retrieval'],
['bi-encoder','Bi-encoder','bi-encoders|dual encoder|two-tower','Two encoders that embed the query and the passage separately; relevance is the dot product of the two vectors. Passages can be embedded once, ahead of time.','dl/nlp/rag/#retrieval'],
['dpr','Dense Passage Retrieval','DPR','A BERT bi-encoder retriever (Karpukhin et al., 2020) trained so that a question’s vector is close to the vectors of passages that answer it. The retriever inside the original RAG.','dl/nlp/rag/#rag'],
['mips','Maximum inner product search','MIPS|approximate nearest neighbour|ANN search|nearest-neighbour search','Finding the stored vectors with the largest dot product with a query. Done approximately (FAISS, HNSW) to stay fast over millions of passages.','dl/nlp/rag/#retrieval'],
['faiss','FAISS','HNSW|vector index|vector database','A library for fast (approximate) similarity search over large sets of vectors; HNSW is a graph-based index it supports.','dl/nlp/rag/#py'],
['chunk','Chunk','chunks|chunking|passage|passages','A short piece of a document (the RAG paper uses 100-word passages) that is indexed and retrieved as one unit.','dl/nlp/rag/#pipeline'],
['hybrid-search','Hybrid search','hybrid retrieval|reciprocal rank fusion|RRF','Combining sparse and dense rankings, for example a weighted sum of normalised scores or reciprocal rank fusion \\(\\sum 1/(60+\\text{rank})\\).','dl/nlp/rag/#retrieval'],
['parametric-memory','Parametric memory','non-parametric memory|parametric knowledge','Knowledge stored in a model’s weights (parametric) versus in an external, swappable index of documents (non-parametric).','dl/nlp/rag/#rag'],
['marginalise','Marginalise','marginalisation|marginal likelihood|marginalize|marginalized','Sum a probability over an unobserved variable: RAG sums over which passage was used, weighted by how likely the retriever thought it was.','dl/nlp/rag/#rag'],
['fid','Fusion-in-Decoder','FiD|fusion in decoder','A reader that encodes each retrieved passage separately and lets the decoder attend over all of them at once (Izacard & Grave, 2021).','dl/nlp/rag/#fid'],
['raft','RAFT','retrieval-augmented fine-tuning','Retrieval-Augmented Fine-Tuning (Zhang et al., 2024): fine-tune on questions paired with a golden document plus distractors and a cited chain-of-thought answer.','dl/nlp/rag/#raft'],
['distractor','Distractor','distractors|distractor documents','A retrieved passage that looks relevant but does not contain the answer. RAFT trains with them so the model learns to ignore them.','dl/nlp/rag/#raft'],
['golden-document','Golden document','oracle document|golden documents|oracle','The passage that actually contains the answer to a training question.','dl/nlp/rag/#raft'],
['chain-of-thought','Chain of thought','CoT|chain-of-thought|reasoning chain','An answer that writes out its reasoning steps before the final answer; RAFT’s answers also quote the supporting passage.','dl/nlp/rag/#raft'],
['hallucination','Hallucination','hallucinate|hallucinations','A fluent but false statement from a language model. Grounding answers in retrieved text reduces it, but does not remove it.'],
['multimodal','Multimodal','multi-modal|multimodal model|multimodal embedding|multimodal embeddings','Using more than one kind of input (modality), such as text and images, in one model. A multimodal embedding puts both kinds into the same vector space so they can be compared or mixed.','dl/nlp/visualbert/'],
['visual-token','Visual token','visual tokens|image token|image tokens','One vector that stands for a piece of an image (a patch, a detected object region, or a codebook entry), so that a transformer can read an image the way it reads words.','dl/nlp/visual-tokenisation/'],
['patch','Patch','patches|image patch|image patches|patch embedding','A small square of an image, for example 16 × 16 pixels. A vision transformer cuts the image into a grid of patches and turns each into one token.','dl/nlp/visual-tokenisation/'],
['vit','Vision transformer','ViT|vision transformers','A transformer that reads an image as a sequence of patch tokens, with a learned position embedding for each patch and a [CLS] token whose output summarises the image (Dosovitskiy et al., 2020).','dl/nlp/visual-tokenisation/'],
['region-features','Region features','region feature|RoI features|region of interest|object regions|detected regions','Feature vectors for the boxes an object detector finds in an image (often 2048 numbers from Faster R-CNN, plus the box position). VisualBERT, ViLBERT and LXMERT use them as visual tokens.','dl/nlp/visual-tokenisation/'],
['faster-rcnn','Faster R-CNN','Faster RCNN|object detector|object detection','A two-stage object detector: a region proposal network suggests boxes, then a second network classifies each box and refines it. Its per-box features were the standard visual tokens around 2018 to 2020.'],
['codebook','Codebook','codebooks|vector quantisation|vector quantization|VQ|VQ-VAE|dVAE','A learned list of K vectors. Vector quantisation replaces each patch vector by the id of its nearest codebook vector, which turns an image into discrete tokens like words.','dl/nlp/visual-tokenisation/'],
['cls-token','[CLS] token','CLS|[CLS]|class token','A special token placed at the start of the sequence. Because it attends to every other token, its final vector is used as a summary of the whole input for classification.'],
['segment-embedding','Segment embedding','segment embeddings|token type|token-type embedding|modality embedding','A learned vector added to every token that says which part of the input it comes from: sentence A or B in BERT, text or image in VisualBERT.','dl/nlp/visualbert/'],
['co-attention','Co-attention','co-attentional|Co-TRM|co-attentional transformer|co-transformer|co-transformers','Two-way cross-attention between two streams: the text stream’s queries attend to the image stream’s keys and values, and the image’s queries attend to the text, in the same layer. ViLBERT’s Co-TRM layer.','dl/nlp/vilbert/'],
['vilbert','ViLBERT','ViL-BERT','A two-stream vision-and-language BERT: one transformer for text, one for image regions, connected by co-attentional transformer layers (Lu et al., 2019).','dl/nlp/vilbert/'],
['visualbert','VisualBERT','Visual BERT','A single BERT-style transformer that reads a caption and the detected object regions of an image as one sequence, so self-attention can link words to image regions (Li et al., 2019).','dl/nlp/visualbert/'],
['single-stream','Single-stream model','single-stream|single stream|two-stream|dual-stream','Single-stream: text and image tokens go through one shared transformer (VisualBERT, UNITER). Two-stream: each modality has its own transformer and they exchange information through co-attention (ViLBERT, LXMERT).','dl/nlp/visualbert/'],
['grounding','Grounding','grounded|visual grounding|phrase grounding','Linking a word or phrase to the part of an image it refers to, for example "the dog" to the box around the dog.','dl/nlp/visualbert/'],
['vqa','Visual question answering','VQA','A task where a model gets an image and a question about it ("What colour is the bus?") and must produce the answer.','dl/nlp/visualbert/'],
['clip','CLIP','contrastive language-image pre-training','Two separate encoders, one for images and one for text, trained so that matching image–caption pairs have high cosine similarity and mismatched pairs low (Radford et al., 2021).','dl/nlp/clip/'],
['infonce','InfoNCE','contrastive loss|contrastive|symmetric contrastive loss','A contrastive loss: score every pair in a batch, then apply softmax cross-entropy so each item picks out its true partner among all the others. CLIP uses it in both directions, image→text and text→image.','dl/nlp/clip/'],
['zero-shot','Zero-shot classification','zero-shot|zero shot','Classifying into labels the model was never explicitly trained on: write each label as a text prompt, embed it, and pick the label whose embedding is closest to the image’s.','dl/nlp/clip/'],
['exact-match','Exact match','EM','The share of answers that equal a reference answer exactly after light normalisation (case, punctuation, articles). The main open-domain QA metric.'],
/* ---------- mathematical concepts ---------- */
['orthogonal','Orthogonal','perpendicular vectors','Two vectors are orthogonal when their dot product is zero, \\(a\\cdot b=0\\): they meet at a right angle and share no direction.','math/vectors/#dot'],
['span','Span (of vectors)','linear span|linear combination|linear combinations','All the vectors you can reach by adding scaled copies of the given ones, \\(c_1v_1+\\dots+c_kv_k\\).','math/vectors/#arrows'],
['linear-map','Linear transformation','linear map|linear maps|linear transformations','A function that keeps straight lines straight and the origin fixed: \\(L(\\alpha x+\\beta y)=\\alpha L(x)+\\beta L(y)\\). Every one is multiplication by a matrix.','math/matrices/#transform'],
['determinant','Determinant','det|determinants','The factor by which a square matrix scales areas (volumes). Zero means space is flattened and the matrix has no inverse. For \\(2\\times2\\): \\(ad-bc\\).','math/matrices/#det'],
['rank','Matrix rank','rank-deficient|full rank|full-rank','The number of independent columns (equivalently rows): how many dimensions survive the transformation. Computed by counting pivots or nonzero singular values.','math/matrices/#rank'],
['null-space','Null space','kernel of a matrix|nullspace','All vectors \\(x\\) with \\(Ax=0\\): the directions the matrix crushes to zero. Its dimension is (number of columns) − rank.','math/matrices/#rank'],
['inverse','Inverse matrix','matrix inverse|inverse of a matrix|invertible','\\(A^{-1}\\) undoes \\(A\\): \\(A^{-1}A=I\\). It exists only for square matrices with nonzero determinant (full rank).','math/matrices/#inverse'],
['column-space','Column space','range of a matrix','All possible outputs \\(Ax\\): the span of the columns. Least squares projects the target onto it.','math/projections/#lsq'],
['orthonormal','Orthonormal','orthonormal basis|orthonormal columns','Vectors of length 1 that are all mutually perpendicular. Coordinates in an orthonormal basis are just dot products.','math/projections/#ortho'],
['orthogonal-matrix','Orthogonal matrix','rotation matrix|orthogonal matrices','A square matrix \\(Q\\) with orthonormal columns, so \\(Q^\\top Q=I\\) and \\(Q^{-1}=Q^\\top\\). It rotates or reflects without changing lengths.','math/decompositions/'],
['diagonal-matrix','Diagonal matrix','diagonal matrices','A matrix that is zero off the diagonal. It just stretches each axis by its diagonal entry.','math/decompositions/'],
['triangular','Triangular matrix','upper triangular|lower triangular|triangular matrices','A matrix that is zero above (lower triangular) or below (upper triangular) the diagonal. Systems with one are solved by substitution, one row at a time.','math/decompositions/#lu'],
['positive-definite','Positive definite','positive semi-definite|positive-definite|PSD|SPD','A symmetric matrix with \\(x^\\top Ax>0\\) for every \\(x\\ne0\\): all eigenvalues positive, a bowl-shaped quadratic. Covariance matrices and \\(X^\\top X\\) are (semi-)definite.','math/decompositions/#chol'],
['spectral-theorem','Spectral theorem','','Every real symmetric matrix can be written \\(Q\\Lambda Q^\\top\\): real eigenvalues and perpendicular eigenvectors.','math/decompositions/#eigen'],
['svd','SVD','singular value decomposition','\\(A=U\\Sigma V^\\top\\): any matrix is a rotation, a stretch along perpendicular axes, then another rotation.','math/svd/'],
['singular-value','Singular value','singular values','The stretch factors \\(\\sigma_1\\ge\\sigma_2\\ge\\dots\\ge0\\) in the SVD: the semi-axis lengths of the ellipse that the unit circle becomes.','math/svd/#geom'],
['low-rank','Low-rank approximation','low-rank|truncated SVD|rank-k approximation','Keeping only the first \\(k\\) terms \\(\\sum_{i\\le k}\\sigma_iu_iv_i^\\top\\) of the SVD. By the Eckart–Young theorem it is the closest rank-\\(k\\) matrix.','math/svd/#lowrank'],
['pseudo-inverse','Pseudo-inverse','Moore–Penrose|pseudoinverse','\\(A^+=V\\Sigma^+U^\\top\\): inverts every nonzero singular value. \\(A^+b\\) is the minimum-norm least-squares solution.','math/svd/#uses'],
['sample-space','Sample space','','The set \\(\\Omega\\) of everything that can happen in a random experiment, e.g. the 36 outcomes of two dice.','math/probability/#basics'],
['event','Event (probability)','','A set of outcomes, such as "the dice sum to 7". Its probability is the total probability of its outcomes.','math/probability/#basics'],
['conditional-probability','Conditional probability','conditional probabilities|P(A|B)','\\(P(A\\mid B)=P(A\\cap B)/P(B)\\): the probability of \\(A\\) once you know \\(B\\) happened.','math/probability/#basics'],
['independence','Independence','independent events|statistically independent','\\(A\\) and \\(B\\) are independent when knowing one does not change the chance of the other: \\(P(A\\cap B)=P(A)P(B)\\).','math/probability/#basics'],
['random-variable','Random variable','random variables','A number determined by a random outcome, like the sum of two dice. Its distribution says how probability is spread over its values.','math/probability/#rv'],
['mle','Maximum likelihood estimation','maximum likelihood|MLE|maximum-likelihood estimate','Choosing the parameters under which the observed data would have been most probable: \\(\\hat\\theta=\\arg\\max_\\theta\\sum_i\\log p(x^{(i)};\\theta)\\). Least squares and cross-entropy are special cases.','math/mle/'],
['log-likelihood','Log-likelihood','log likelihood','The log of the likelihood, \\(\\ell(\\theta)=\\sum_i\\log p(x^{(i)};\\theta)\\). It turns a product into a sum and has the same peak.','math/mle/#lik'],
['nll','Negative log-likelihood','NLL|negative log likelihood','Minus the log-likelihood. Minimising it is maximum likelihood; with Gaussian noise it is squared error, with Bernoulli labels it is log loss.','math/mle/#loss'],
['fisher-information','Fisher information','Fisher|information matrix','The expected curvature of the log-likelihood, \\(I(\\theta)=-\\mathbb E[\\ell^{\\prime\\prime}(\\theta)]\\). A sharp peak means the data pin the parameter down; the MLE\u2019s variance is about \\(1/I\\).','math/mle/#fisher'],
['conjugate-prior','Conjugate prior','conjugate|conjugacy','A prior that gives a posterior of the same family, so updating is simple bookkeeping: Beta for coin flips, Normal for a Normal mean, Dirichlet for counts.','math/bayesian/#update'],
['credible-interval','Credible interval','credible intervals|95% credible interval','An interval holding a given share (say 95%) of the posterior: given the data and prior, the parameter lies in it with that probability.','math/bayesian/#update'],
['posterior-mean','Posterior mean','Bayes estimate','The average of the posterior distribution. It is the best single guess when errors cost their square.','math/bayesian/#update'],
['posterior-predictive','Posterior predictive','predictive distribution','The distribution of a new observation, averaging the model\u2019s predictions over the posterior of its parameters, so it includes parameter uncertainty.','math/bayesian/#blr'],
['mcmc','Markov chain Monte Carlo','MCMC|Metropolis|Metropolis-Hastings|Metropolis–Hastings','Drawing samples from a distribution known only up to a constant, by a random walk that accepts moves according to probability ratios. The standard way to explore a posterior.','math/bayesian/#mcmc'],
['vae','Variational autoencoder','VAE|VAEs|variational inference','A generative model trained by fitting a simple approximate posterior over latent variables, by maximising a lower bound on the likelihood.','math/bayesian/#mcmc'],
['metric','Evaluation metric','metrics|evaluation metrics','A number that summarises how well predictions match the truth on held-out data. Unlike the training loss, it is chosen to reflect what you actually care about.','ml/metrics/'],
['recall','Recall','sensitivity|true-positive rate|TPR','Of the real positives, the share the model found: \\(TP/(TP+FN)\\).','ml/metrics/#confusion'],
['f1','F1 score','F1|F-score|F-beta','The harmonic mean of precision and recall, \\(2PR/(P+R)\\). It is low whenever either one is low.','ml/metrics/#confusion'],
['calibration','Calibration','calibrated|reliability diagram|temperature scaling','Whether predicted probabilities match observed frequencies: of the cases given 70%, about 70% should happen.','ml/metrics/#prob'],
['ndcg','nDCG','nDCG@k|DCG|normalised discounted cumulative gain','A ranking metric: graded relevance, discounted by \\(\\log_2(\\text{rank}+1)\\), divided by the best possible score.','ml/metrics/#rank'],
['bleu','BLEU','ROUGE|BLEU score','Overlap metrics for generated text: BLEU averages clipped n-gram precisions with a brevity penalty (translation); ROUGE measures n-gram recall (summaries).','ml/metrics/#gen'],
['iou','IoU','intersection over union|Jaccard|mAP|mean average precision','Overlap of two regions: shared area divided by total covered area. Detection counts a hit when IoU ≥ 0.5; mAP averages precision over classes and thresholds.','ml/metrics/#vision'],
['validation-set','Validation set','validation data|dev set|held-out set','Data kept aside from training and used to choose hyperparameters and models. Because you make decisions with it, it is no longer a fair test.','ml/datasets/#splits'],
['data-leakage','Data leakage','leakage|leak|train-test leakage','When information from the test data, or from the future, sneaks into training, making scores look better than they will be in real use.','ml/datasets/#leak'],
['stratified','Stratified split','stratification|stratify','Splitting data so each part keeps the same class proportions as the whole, essential when one class is rare.','ml/datasets/#imbalance'],
['distribution-shift','Distribution shift','covariate shift|dataset shift|concept drift|label shift','When the data a model meets in use differ from the data it was trained on, so test scores no longer predict real performance.','ml/datasets/#shift'],
['benchmark','Benchmark','benchmarks|leaderboard','A fixed dataset and metric used to compare models. Heavily reused benchmarks saturate and can leak into training data.','ml/datasets/#famous'],
['contamination','Benchmark contamination','data contamination|test contamination','Test questions appearing in a model\u2019s training data, so it can recall answers rather than solve them.','ml/datasets/#leak'],
['learning-curve','Learning curve','learning curves|scaling law|scaling laws','Test error as a function of training-set size (or model size or compute). It typically falls as a power law towards a floor.','ml/datasets/#learning'],
['quantisation','Quantisation','quantization|quantised|int8|int4|PTQ|QAT|post-training quantisation|quantisation-aware training','Storing weights (and activations) in fewer bits, such as 8 or 4 instead of 32, by mapping them onto a small grid of levels.','dl/nn/compression/#quant'],
['distillation','Knowledge distillation','distillation|distil|teacher–student|teacher-student','Training a small student model to match a large teacher\u2019s softened output probabilities, which carry more information than hard labels.','dl/nn/compression/#distil'],
['lottery-ticket','Lottery ticket hypothesis','lottery ticket|winning ticket','The finding that large networks contain small subnetworks which, trained from the same initial weights, reach similar accuracy.','dl/nn/compression/#prune'],
['moe','Mixture of experts','MoE|mixture-of-experts|experts','A layer with many expert sub-networks and a router that sends each token to only a few, so a model can have many parameters but use few per token.','dl/nn/compression/#arch'],
['kv-cache','KV cache','key-value cache|KV-cache','Stored keys and values of earlier tokens, so a transformer generating text does not recompute them at every step. It can need more memory than the weights.','dl/nn/compression/#arch'],
['lora','LoRA','low-rank adaptation','Fine-tuning by freezing the weights and learning a small low-rank update \\(BA\\) for selected matrices.','dl/nn/compression/#lowrank'],
['weight-pruning','Weight pruning','magnitude pruning|structured pruning|pruning|sparsity','Setting the least important weights of a network to zero, usually those with the smallest magnitude, then fine-tuning so the rest can compensate. Structured pruning removes whole neurons or channels so the network gets genuinely smaller.','dl/nn/compression/#prune'],
['estimator','Estimator','estimators|estimate from data','A rule that turns data into a guess of an unknown quantity, like the sample mean for \\(\\mu\\). Being computed from random data, it is itself random.','math/inference/#sampling'],
['standard-error','Standard error','standard errors|SE','The standard deviation of an estimate across repeated samples: how far off it typically is. For a mean, \\(\\sigma/\\sqrt n\\).','math/inference/#sampling'],
['clt','Central limit theorem','CLT','Averages of many independent draws are approximately normally distributed, \\(\\bar x\\approx\\mathcal N(\\mu,\\sigma^2/n)\\), whatever the original distribution.','math/inference/#sampling'],
['confidence-interval','Confidence interval','confidence intervals|CI','A range computed from data by a procedure that captures the true value in, say, 95% of repeated samples: \\(\\bar x\\pm1.96\\,s/\\sqrt n\\).','math/inference/#ci'],
['null-hypothesis','Null hypothesis','H0|null hypotheses','The "nothing is going on" explanation a test tries to reject, e.g. "the two models are equally accurate".','math/inference/#test'],
['p-value','p-value','p-values|p value','If the null hypothesis were true, the probability of data at least as extreme as what was seen. Small means surprising; it is not the probability that the null is true.','math/inference/#test'],
['type-i-error','Type I and II errors','Type I error|Type II error|false alarm|false positive rate','Type I: rejecting a true null (false alarm, rate \\(\\alpha\\)). Type II: missing a real effect (rate \\(\\beta\\)).','math/inference/#power'],
['power','Statistical power','power of a test','The probability a test detects an effect that is really there, \\(1-\\beta\\). It grows with sample size and effect size.','math/inference/#power'],
];

const G = window.GLOSS = {}; const alias = [];
E.forEach(([k,t,a,d,link])=>{ G[k]={t,d,link}; [t,...(a?a.split('|'):[])].forEach(s=>{ s=s.trim(); if(s) alias.push([s,k]); }); });
G._alias = alias;

/* site root, derived from this script's URL (…/ml/assets/gloss.js) */
const me = document.currentScript; const ROOT = me ? new URL('../../', me.src).href : '/';
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function find(key){ if(!key) return null; if(G[key] && key[0]!=='_') return key; const low=key.toLowerCase().trim(); const hit=alias.find(([s])=>s.toLowerCase()===low); return hit?hit[1]:null; }

/* ---- popover ---- */
let pop=null, cur=null;
function close(){ if(pop){ pop.remove(); pop=null; } if(cur){ cur.setAttribute('aria-expanded','false'); cur=null; } }
function open(el){ const key=find(el.dataset.t||el.textContent); if(!key){ console.warn('glossary: no entry for', el.dataset.t||el.textContent); return; }
  if(cur===el){ close(); return; } close(); const g=G[key]; cur=el; el.setAttribute('aria-expanded','true');
  pop=document.createElement('div'); pop.className='gpop'; pop.setAttribute('role','dialog'); pop.setAttribute('aria-label',g.t);
  const here=location.href.split('#')[0], target=g.link?ROOT+g.link:null, same=target&&target.split('#')[0]===here;
  pop.innerHTML=`<button class="gx" aria-label="Close">×</button><b>${esc(g.t)}</b><p>${g.d}</p>`+(target?`<a href="${target}">${same?'See this section':'Learn more'} →</a>`:'');
  document.body.appendChild(pop);
  if(window.renderMathInElement) try{ renderMathInElement(pop,{delimiters:[{left:'\\(',right:'\\)',display:false}],throwOnError:false}); }catch(e){}
  const r=el.getBoundingClientRect(), pw=pop.offsetWidth, vw=document.documentElement.clientWidth;
  let x=r.left+window.scrollX; x=Math.max(window.scrollX+12, Math.min(x, window.scrollX+vw-pw-12));
  let y=r.bottom+window.scrollY+8; if(r.bottom+pop.offsetHeight+16>window.innerHeight && r.top>pop.offsetHeight+16) y=r.top+window.scrollY-pop.offsetHeight-8;
  pop.style.left=x+'px'; pop.style.top=y+'px';
  pop.querySelector('.gx').onclick=close; }
document.addEventListener('click',e=>{ const t=e.target.closest('.term'); if(t){ e.preventDefault(); open(t); return; } if(pop && !pop.contains(e.target)) close(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); if((e.key==='Enter'||e.key===' ') && e.target.classList && e.target.classList.contains('term')){ e.preventDefault(); open(e.target); } });
window.addEventListener('resize',close);

/* ---- automatic linking: first mention of each term in the page's prose ---- */
/* aliases too generic to auto-link (still usable as data-t on a manual .term) */
const NOAUTO=new Set(['step','steps','iteration','iterations','forward','value','values','key','keys','query','queries','head','heads','mask','masking','attend','attends','unit','units','root','average','information','depth','shrink','shrinks','shrunk','schedule','schedules','tree','trees','network','networks','boundary','project','projected','projecting','identity','vanish','vanishes','causal','contextual','recurrent','stochastic','torch','leaky','saddle','pure','impure','Σ','φ','η','eta','‖w‖','∇','##','h_t','c_t','ξ','α_i','δ_k','Q, K, V','Q/K/V','minimum','minima','split','splits','splitting','target','mean','expectation','probability','probabilities','schedule','tree depth','unknown word','recall','sensitivity','specificity','UNK','[UNK]','[MASK]','init','convexity','regularise','regularize','regularised','regularized','normalise','normalize','normalised','normalized','curvature','second derivative','residuals','bootstrap sample','resampling','dataset','datasets','classify','tokenise','tokenize','tokenised','fine-tune','generalise','generalize','generalises','reconstruct','reconstructed','saturate','saturates','saturated','saturating','standardised','standardized']);
const SKIP='A,BUTTON,CODE,PRE,SCRIPT,STYLE,LABEL,OUTPUT,SELECT,TEXTAREA,H1,H2,H3,H4,H5,SUMMARY,SVG,CANVAS,KBD';
function autolink(root){ root=root||document;
  const scopes=[...root.querySelectorAll('.lede,.intro,.prose,.sub,.note,.hint,td,.mathbox ~ p')].filter(el=>!el.closest('header,.top,.gpop,.code,.toc,.algnav'));
  const done=new Set([...document.querySelectorAll('.term')].map(t=>find(t.dataset.t||t.textContent)).filter(Boolean));
  const list=alias.filter(([s])=>s.length>1 && !NOAUTO.has(s)).sort((a,b)=>b[0].length-a[0].length);
  const rx=new RegExp('(^|[^\\p{L}\\p{N}_\u2019\'-])('+list.map(([s])=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?=$|[^\\p{L}\\p{N}_-])','giu');
  const bySurface=new Map(list.map(([s,k])=>[s.toLowerCase(),[s,k]]));
  scopes.forEach(scope=>{ const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,{acceptNode:n=>{ for(let p=n.parentElement;p&&p!==scope.parentElement;p=p.parentElement){ if(SKIP.includes(p.tagName)||p.classList.contains('katex')||p.classList.contains('term')||p.classList.contains('stat')||p.classList.contains('heat')||p.classList.contains('cm')) return NodeFilter.FILTER_REJECT; } return /\S/.test(n.data)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT; }});
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{ let txt=n.data, m, last=0, frag=null; rx.lastIndex=0;
      while((m=rx.exec(txt))){ const word=m[2], hit=bySurface.get(word.toLowerCase()); if(!hit) continue; const [surf,key]=hit; if(done.has(key)) continue;
        /* acronyms (MAP, LDA, BN, ...) only match in the same case */
        if(/[A-Z]/.test(surf) && surf===surf.toUpperCase() && word!==surf) continue;
        done.add(key); frag=frag||document.createDocumentFragment(); const st=m.index+m[1].length;
        frag.appendChild(document.createTextNode(txt.slice(last,st))); const a=document.createElement('a'); a.className='term auto'; a.href='#'; a.dataset.t=key; a.setAttribute('role','button'); a.textContent=word; frag.appendChild(a); last=st+word.length; }
      if(frag){ frag.appendChild(document.createTextNode(txt.slice(last))); n.parentNode.replaceChild(frag,n); } }); }); }
GLOSS.autolink=autolink;
function init(){ document.querySelectorAll('.term:not([href])').forEach(t=>{ t.setAttribute('href','#'); t.setAttribute('role','button'); });
  if(!document.body.hasAttribute('data-noautolink')) autolink(document); }
if(document.readyState==='complete') setTimeout(init,0); else window.addEventListener('load',()=>setTimeout(init,0));
})();
