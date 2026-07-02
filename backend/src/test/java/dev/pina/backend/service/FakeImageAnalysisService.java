package dev.pina.backend.service;

import dev.pina.ml.v1.AnalysisStep;
import dev.pina.ml.v1.AnalyzeImageRequest;
import dev.pina.ml.v1.AnalyzeImageResponse;
import dev.pina.ml.v1.Embedding;
import dev.pina.ml.v1.FaceDetection;
import dev.pina.ml.v1.ImageAnalysisGrpc;
import dev.pina.ml.v1.ModelRef;
import dev.pina.ml.v1.NormalizedBoundingBox;
import dev.pina.ml.v1.StepResult;
import dev.pina.ml.v1.StepStatus;
import dev.pina.ml.v1.Tag;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import io.quarkus.grpc.GrpcService;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;

/**
 * Fake ML service hosted by the Quarkus test gRPC server (port 9001 in test
 * mode). Tests point quarkus.grpc.clients.ml at it and script behavior via
 * {@link #HANDLER}; a null handler answers with a full successful analysis.
 */
@GrpcService
public class FakeImageAnalysisService extends ImageAnalysisGrpc.ImageAnalysisImplBase {

	public static final AtomicReference<Function<AnalyzeImageRequest, AnalyzeImageResponse>> HANDLER = new AtomicReference<>();

	@Override
	public void analyzeImage(AnalyzeImageRequest request, StreamObserver<AnalyzeImageResponse> observer) {
		Function<AnalyzeImageRequest, AnalyzeImageResponse> handler = HANDLER.get();
		try {
			AnalyzeImageResponse response = handler != null
					? handler.apply(request)
					: fullSuccess(request, unitVector(0));
			observer.onNext(response);
			observer.onCompleted();
		} catch (StatusRuntimeException e) {
			observer.onError(e);
		}
	}

	public static float[] unitVector(int hotIndex) {
		float[] vector = new float[512];
		vector[hotIndex] = 1.0f;
		return vector;
	}

	public static AnalyzeImageResponse fullSuccess(AnalyzeImageRequest request, float[] imageEmbedding) {
		return AnalyzeImageResponse.newBuilder().setRequestId(request.getRequestId())
				.addStepResults(completed(AnalysisStep.IMAGE_EMBEDDING, "clip-test"))
				.addStepResults(completed(AnalysisStep.TAGGING, "text-test"))
				.addStepResults(completed(AnalysisStep.FACE_DETECTION, "det-test"))
				.addStepResults(completed(AnalysisStep.FACE_EMBEDDING, "rec-test"))
				.setImageEmbedding(embedding(imageEmbedding))
				.addTags(Tag.newBuilder().setLabel("beach").setConfidence(0.4f))
				.addTags(Tag.newBuilder().setLabel("dog").setConfidence(0.2f))
				.addFaces(FaceDetection.newBuilder()
						.setBox(NormalizedBoundingBox.newBuilder().setX(0.1f).setY(0.2f).setWidth(0.3f).setHeight(0.4f))
						.setConfidence(0.95f).setEmbedding(embedding(unitVector(3))))
				.build();
	}

	public static AnalyzeImageResponse partialFaceFailure(AnalyzeImageRequest request, float[] imageEmbedding) {
		return AnalyzeImageResponse.newBuilder().setRequestId(request.getRequestId())
				.addStepResults(completed(AnalysisStep.IMAGE_EMBEDDING, "clip-test"))
				.addStepResults(completed(AnalysisStep.TAGGING, "text-test"))
				.addStepResults(StepResult.newBuilder().setStep(AnalysisStep.FACE_DETECTION)
						.setStatus(StepStatus.FAILED).setModel(model("det-test")).setErrorMessage("detector crashed"))
				.addStepResults(StepResult.newBuilder().setStep(AnalysisStep.FACE_EMBEDDING)
						.setStatus(StepStatus.SKIPPED_UNAVAILABLE).setModel(model("rec-test"))
						.setErrorMessage("requires a completed face detection step"))
				.setImageEmbedding(embedding(imageEmbedding))
				.addTags(Tag.newBuilder().setLabel("beach").setConfidence(0.4f)).build();
	}

	@Override
	public void getServiceStatus(dev.pina.ml.v1.GetServiceStatusRequest request,
			StreamObserver<dev.pina.ml.v1.GetServiceStatusResponse> observer) {
		dev.pina.ml.v1.GetServiceStatusResponse.Builder builder = dev.pina.ml.v1.GetServiceStatusResponse.newBuilder()
				.setServiceVersion("0.1.0-test").setActiveProfile("default").setReady(true)
				.setProfile(dev.pina.ml.v1.RuntimeProfile.newBuilder().setName("default").setMaxParallelAnalyses(4)
						.setAnalysisMaxResolution(1024).addExecutionProviders("CPUExecutionProvider"))
				.addInferenceSettings(dev.pina.ml.v1.InferenceSetting.newBuilder().setKey("PINA_ML_TAG_TOP_K")
						.setLabel("tag_top_k").setValue("8"));
		// clip-test: full license (url + notes present).
		builder.addModels(dev.pina.ml.v1.ModelAvailability.newBuilder().setModel(model("clip-test"))
				.setStep(AnalysisStep.IMAGE_EMBEDDING).setAvailable(true).setLicense(
						dev.pina.ml.v1.License.newBuilder().setSpdx("MIT").setUrl("https://opensource.org/license/mit")
								.setCommercialUse(true).setAllowBundling(true).setNotes("bundled")));
		// text-test: license without url/notes (exercises emptyToNull -> null).
		builder.addModels(dev.pina.ml.v1.ModelAvailability.newBuilder().setModel(model("text-test"))
				.setStep(AnalysisStep.TAGGING).setAvailable(true).setLicense(dev.pina.ml.v1.License.newBuilder()
						.setSpdx("Apache-2.0").setCommercialUse(true).setAllowBundling(true)));
		// det-test: non-commercial, bundling forbidden.
		builder.addModels(dev.pina.ml.v1.ModelAvailability.newBuilder().setModel(model("det-test"))
				.setStep(AnalysisStep.FACE_DETECTION).setAvailable(true)
				.setLicense(dev.pina.ml.v1.License.newBuilder().setSpdx("NonCommercial").setCommercialUse(false)
						.setAllowBundling(false).setNotes("downloaded")));
		// rec-test: no license (exercises the hasLicense=false branch).
		builder.addModels(dev.pina.ml.v1.ModelAvailability.newBuilder().setModel(model("rec-test"))
				.setStep(AnalysisStep.FACE_EMBEDDING).setAvailable(true));
		observer.onNext(builder.build());
		observer.onCompleted();
	}

	/** Full success with custom face descriptors (deterministic boxes). */
	public static AnalyzeImageResponse withFaces(AnalyzeImageRequest request, float[] imageEmbedding,
			float[][] faceDescriptors) {
		AnalyzeImageResponse.Builder builder = AnalyzeImageResponse.newBuilder().setRequestId(request.getRequestId())
				.addStepResults(completed(AnalysisStep.IMAGE_EMBEDDING, "clip-test"))
				.addStepResults(completed(AnalysisStep.TAGGING, "text-test"))
				.addStepResults(completed(AnalysisStep.FACE_DETECTION, "det-test"))
				.addStepResults(completed(AnalysisStep.FACE_EMBEDDING, "rec-test"))
				.setImageEmbedding(embedding(imageEmbedding));
		for (int i = 0; i < faceDescriptors.length; i++) {
			builder.addFaces(FaceDetection
					.newBuilder().setBox(NormalizedBoundingBox.newBuilder().setX(0.1f * (i + 1)).setY(0.1f)
							.setWidth(0.1f).setHeight(0.1f))
					.setConfidence(0.9f).setEmbedding(embedding(faceDescriptors[i])));
		}
		return builder.build();
	}

	/** Detections without descriptors: FACE_EMBEDDING is disabled by profile. */
	public static AnalyzeImageResponse detectionsWithoutDescriptors(AnalyzeImageRequest request, float[] imageEmbedding,
			int faceCount) {
		AnalyzeImageResponse.Builder builder = AnalyzeImageResponse.newBuilder().setRequestId(request.getRequestId())
				.addStepResults(completed(AnalysisStep.IMAGE_EMBEDDING, "clip-test"))
				.addStepResults(completed(AnalysisStep.TAGGING, "text-test"))
				.addStepResults(completed(AnalysisStep.FACE_DETECTION, "det-test")).addStepResults(StepResult
						.newBuilder().setStep(AnalysisStep.FACE_EMBEDDING).setStatus(StepStatus.SKIPPED_DISABLED))
				.setImageEmbedding(embedding(imageEmbedding));
		for (int i = 0; i < faceCount; i++) {
			builder.addFaces(FaceDetection.newBuilder().setBox(
					NormalizedBoundingBox.newBuilder().setX(0.1f * (i + 1)).setY(0.1f).setWidth(0.1f).setHeight(0.1f))
					.setConfidence(0.9f));
		}
		return builder.build();
	}

	private static Embedding embedding(float[] values) {
		Embedding.Builder builder = Embedding.newBuilder();
		for (float value : values) {
			builder.addValues(value);
		}
		return builder.build();
	}

	private static StepResult.Builder completed(AnalysisStep step, String modelId) {
		return StepResult.newBuilder().setStep(step).setStatus(StepStatus.COMPLETED).setModel(model(modelId))
				.setDurationMs(5);
	}

	private static ModelRef.Builder model(String modelId) {
		return ModelRef.newBuilder().setModelId(modelId).setVersion("1.0").setRuntime("onnxruntime");
	}
}
